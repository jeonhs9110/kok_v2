import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

const supabase = getSupabaseBrowser();

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
  // breakdowns
  dailyVisits: { date: string; count: number }[];
  countries: { country: string; count: number }[];
  productClicks: { id: string; name: string; clicks: number }[];
  wishRanks: { id: string; name: string; wishCount: number }[];
}

export const EMPTY: DashboardData = {
  isLive: false,
  visits7d: 0, newMembers7d: 0, wishlistAdds7d: 0,
  visitsPrev7d: 0, newMembersPrev7d: 0, wishlistAddsPrev7d: 0,
  activeProducts: 0, totalProducts: 0, totalMembers: 0, totalWishlist: 0,
  totalVisits: 0, productDetailViews: 0,
  dailyVisits: [], countries: [], productClicks: [], wishRanks: [],
};

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
        supabase.from('analytics').select('country, path, created_at'),
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
      }
      const dailyVisits = labels.map(d => ({ date: d, count: dailyBuckets[d] }));

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
        productClicks,
        wishRanks,
      });
    } catch {
      setData(EMPTY);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

  return { data, isLoading, fetchAll };
}
