import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

const supabase = getSupabaseBrowser();

export type TrafficSource = 'google' | 'naver' | 'instagram' | 'kakao' | 'direct' | 'other';

export interface DashboardData {
  isLive: boolean;
  // current 7-day window
  visits7d: number;
  newMembers7d: number;
  wishlistAdds7d: number;
  // previous 7-day window — drives trend %
  visitsPrev7d: number;
  newMembersPrev7d: number;
  wishlistAddsPrev7d: number;
  // current totals
  activeProducts: number;
  totalProducts: number;
  totalMembers: number;
  totalWishlist: number;
  totalVisits: number;
  productDetailViews: number;
  // 7d visitor uniqueness — derived from analytics.ip_hash
  uniqueVisitors7d: number;
  returningVisitors7d: number;
  // breakdowns
  dailyVisits: { date: string; count: number }[];
  countries: { country: string; count: number }[];
  trafficSources: { source: TrafficSource; label: string; count: number }[];
  productClicks: { id: string; name: string; clicks: number }[];
  wishRanks: { id: string; name: string; wishCount: number }[];
}

export const EMPTY: DashboardData = {
  isLive: false,
  visits7d: 0, newMembers7d: 0, wishlistAdds7d: 0,
  visitsPrev7d: 0, newMembersPrev7d: 0, wishlistAddsPrev7d: 0,
  activeProducts: 0, totalProducts: 0, totalMembers: 0, totalWishlist: 0,
  totalVisits: 0, productDetailViews: 0,
  uniqueVisitors7d: 0, returningVisitors7d: 0,
  dailyVisits: [], countries: [], trafficSources: [], productClicks: [], wishRanks: [],
};

const SOURCE_LABEL: Record<TrafficSource, string> = {
  google: '구글',
  naver: '네이버',
  instagram: '인스타그램',
  kakao: '카카오',
  direct: '직접 방문',
  other: '기타',
};

/**
 * Categorize a referrer URL into a Cafe24-style traffic source bucket.
 * The categories cover the major Korean-market acquisition channels:
 * Google + Naver are the search engines; Instagram + Kakao are the
 * social/messenger channels; direct = no referrer (typed URL / app /
 * https→http jump); other = everything else (Daum, Bing, blogs, etc.).
 */
function categorizeReferrer(ref: string | null): TrafficSource {
  if (!ref || ref.trim() === '') return 'direct';
  try {
    const host = new URL(ref).hostname.toLowerCase();
    if (host.includes('google.')) return 'google';
    if (host.includes('naver.')) return 'naver';
    if (host.includes('instagram.') || host === 'l.instagram.com') return 'instagram';
    if (host.includes('kakao.') || host === 'pf.kakao.com') return 'kakao';
    return 'other';
  } catch {
    return 'other';
  }
}

/**
 * 9 parallel queries against Supabase to feed the Cafe24-style dashboard
 * — analytics totals + 7d + prev 7d window, products active/total, users
 * total + 7d + prev 7d, wishlist. Per-row errors degrade to 0 instead
 * of crashing the dashboard. Returns the data, loading flag, and a
 * fetchAll trigger for the refresh button.
 */
export function useDashboardData() {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchAll() {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('No client');

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const start7d = new Date(now - 7 * dayMs).toISOString();
      const start14d = new Date(now - 14 * dayMs).toISOString();

      const [
        analyticsAll,
        analytics7d,
        analyticsPrev7d,
        productsAll,
        productsActive,
        usersAll,
        users7d,
        usersPrev7d,
        wishAll,
      ] = await Promise.all([
        // .limit(10000) caps memory pressure on the browser-side reducer.
        // At ~3K visits/day this still covers >3 days of full detail; older
        // history rolls off the country / referrer breakdowns silently
        // rather than OOMing the admin tab. Replace with a server-aggregated
        // RPC once the table cracks ~50K rows.
        supabase.from('analytics').select('country, path, referrer, created_at, ip_hash').order('created_at', { ascending: false }).limit(10000),
        supabase.from('analytics').select('id', { count: 'exact', head: true }).gte('created_at', start7d),
        supabase.from('analytics').select('id', { count: 'exact', head: true }).gte('created_at', start14d).lt('created_at', start7d),
        supabase.from('products').select('id, name, is_active, images'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', start7d),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', start14d).lt('created_at', start7d),
        supabase.from('wishlist').select('product_id, created_at'),
      ]);

      // Daily visit bucketing — last 7 days, ascending so chart reads left→right as time forward.
      const dailyBuckets: Record<string, number> = {};
      const labels: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * dayMs);
        const key = d.toISOString().slice(0, 10);
        dailyBuckets[key] = 0;
        labels.push(key);
      }
      const countryMap: Record<string, number> = {};
      const productClickMap: Record<string, number> = {};
      const sourceMap: Record<TrafficSource, number> = {
        google: 0, naver: 0, instagram: 0, kakao: 0, direct: 0, other: 0,
      };
      // Per-IP visit counts inside the 7d window — drives the
      // returning-visitor stat. Without the migration-41 ip_hash column
      // every row has ip_hash=null and the maps stay empty, so the
      // dashboard surfaces 0 returning visitors instead of crashing.
      const ipVisits7d: Record<string, number> = {};
      const cutoff7d = now - 7 * dayMs;
      let productDetailViews = 0;
      for (const row of analyticsAll.data ?? []) {
        countryMap[row.country || 'UNKNOWN'] = (countryMap[row.country || 'UNKNOWN'] || 0) + 1;
        const date = row.created_at?.slice(0, 10);
        if (date && date in dailyBuckets) dailyBuckets[date]++;
        const match = row.path?.match(/\/products\/([^/]+)$/);
        if (match) {
          productClickMap[match[1]] = (productClickMap[match[1]] || 0) + 1;
          productDetailViews++;
        }
        const src = categorizeReferrer(row.referrer ?? null);
        sourceMap[src]++;
        if (row.ip_hash && row.created_at && new Date(row.created_at).getTime() >= cutoff7d) {
          ipVisits7d[row.ip_hash] = (ipVisits7d[row.ip_hash] || 0) + 1;
        }
      }
      const dailyVisits = labels.map(d => ({ date: d, count: dailyBuckets[d] }));
      const uniqueVisitors7d = Object.keys(ipVisits7d).length;
      const returningVisitors7d = Object.values(ipVisits7d).filter(c => c > 1).length;

      let wishlistAdds7d = 0;
      let wishlistAddsPrev7d = 0;
      for (const w of wishAll.data ?? []) {
        if (!w.created_at) continue;
        const t = new Date(w.created_at).getTime();
        if (t >= now - 7 * dayMs) wishlistAdds7d++;
        else if (t >= now - 14 * dayMs) wishlistAddsPrev7d++;
      }

      const nameMap: Record<string, string> = {};
      for (const p of productsAll.data ?? []) nameMap[p.id] = p.name;

      const productClicks = Object.entries(productClickMap)
        .filter(([id]) => nameMap[id])
        .map(([id, clicks]) => ({ id, name: nameMap[id], clicks }))
        .sort((a, b) => b.clicks - a.clicks);

      const wishMap: Record<string, number> = {};
      for (const w of wishAll.data ?? []) wishMap[w.product_id] = (wishMap[w.product_id] || 0) + 1;
      const wishRanks = Object.entries(wishMap)
        .filter(([id]) => nameMap[id])
        .map(([id, wishCount]) => ({ id, name: nameMap[id], wishCount }))
        .sort((a, b) => b.wishCount - a.wishCount);

      setData({
        isLive: true,
        visits7d: analytics7d.count ?? 0,
        newMembers7d: users7d.count ?? 0,
        wishlistAdds7d,
        visitsPrev7d: analyticsPrev7d.count ?? 0,
        newMembersPrev7d: usersPrev7d.count ?? 0,
        wishlistAddsPrev7d,
        activeProducts: productsActive.count ?? 0,
        totalProducts: productsAll.data?.length ?? 0,
        totalMembers: usersAll.count ?? 0,
        totalWishlist: wishAll.data?.length ?? 0,
        totalVisits: analyticsAll.data?.length ?? 0,
        productDetailViews,
        dailyVisits,
        countries: Object.entries(countryMap).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count),
        trafficSources: (Object.keys(sourceMap) as TrafficSource[])
          .map(source => ({ source, label: SOURCE_LABEL[source], count: sourceMap[source] }))
          .sort((a, b) => b.count - a.count),
        uniqueVisitors7d,
        returningVisitors7d,
        productClicks,
        wishRanks,
      });
    } catch (err) {
      // Previously this catch was silent — the dashboard rendered EMPTY
      // (zeros across the board) with no console output, no toast, no
      // explanation. Operators saw a "0 visits, 0 users" dashboard and
      // assumed the metrics were broken when in fact a single query had
      // thrown. Log + leave the previous data alone so the operator sees
      // stale data + a refresh button instead of a wipe.
      console.error('[dashboard] fetchAll failed:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  return { data, isLoading, fetchAll };
}
