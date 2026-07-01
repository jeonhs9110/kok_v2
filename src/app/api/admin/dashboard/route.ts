import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import {
  categorizeReferrer,
  TRAFFIC_SOURCE_LABEL,
  SEARCH_SOURCES,
  type TrafficSource,
} from '@/lib/analytics/referrer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const RAW_LIMIT = 20000;

interface RangeRow {
  country: string | null;
  path: string | null;
  referrer: string | null;
  traffic_source: string | null;
  search_keyword: string | null;
  created_at: string;
  ip_hash: string | null;
}

interface ProductRow {
  id: string;
  name: string;
  is_active: boolean;
  images: string[] | null;
}

interface WishlistRow {
  product_id: string;
  created_at: string;
}

interface RawData {
  analyticsRange: RangeRow[];
  analyticsTotal: number;
  analyticsPrevCount: number;
  productsAll: ProductRow[];
  productsActive: number;
  usersAll: number;
  usersCurr: number;
  usersPrev: number;
  wishAll: WishlistRow[];
  // Round 32: pg path pre-aggregates these; supabase path returns
  // undefined and the aggregator falls back to walking wishAll.
  wishlistTotal?: number;
  wishlistAdds?: number;
  wishlistAddsPrev?: number;
  wishRanks?: Array<{ product_id: string; wish_count: number }>;
}

async function fetchRawFromSupabase(
  rangeStart: string,
  rangeEnd: string,
  prevStart: string,
  prevEnd: string,
): Promise<RawData> {
  if (!supabase) throw new Error('supabase not configured');
  const [
    analyticsRange,
    analyticsTotal,
    analyticsPrevCount,
    productsAll,
    productsActive,
    usersAll,
    usersCurr,
    usersPrev,
    wishAll,
  ] = await Promise.all([
    supabase
      .from('analytics')
      .select('country, path, referrer, traffic_source, search_keyword, created_at, ip_hash')
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEnd)
      .order('created_at', { ascending: false })
      .limit(RAW_LIMIT),
    supabase.from('analytics').select('id', { count: 'exact', head: true }),
    supabase.from('analytics').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd),
    supabase.from('products').select('id, name, is_active, images'),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('users').select('id', { count: 'exact', head: true }),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', rangeStart).lt('created_at', rangeEnd),
    supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', prevStart).lt('created_at', prevEnd),
    supabase.from('wishlist').select('product_id, created_at'),
  ]);
  return {
    analyticsRange: (analyticsRange.data ?? []) as RangeRow[],
    analyticsTotal: analyticsTotal.count ?? 0,
    analyticsPrevCount: analyticsPrevCount.count ?? 0,
    productsAll: (productsAll.data ?? []) as ProductRow[],
    productsActive: productsActive.count ?? 0,
    usersAll: usersAll.count ?? 0,
    usersCurr: usersCurr.count ?? 0,
    usersPrev: usersPrev.count ?? 0,
    wishAll: (wishAll.data ?? []) as WishlistRow[],
  };
}

function aggregate(raw: RawData, rangeStart: string, rangeEnd: string, prevStart: string, prevEnd: string) {
  const truncated = raw.analyticsRange.length >= RAW_LIMIT;

  const dailyBuckets: Record<string, number> = {};
  const countryMap: Record<string, number> = {};
  const productClickMap: Record<string, number> = {};
  const sourceMap = {} as Record<TrafficSource, number>;
  (Object.keys(TRAFFIC_SOURCE_LABEL) as TrafficSource[]).forEach(s => { sourceMap[s] = 0; });
  const keywordMap = new Map<string, { source: TrafficSource; keyword: string; count: number }>();
  const ipVisits: Record<string, number> = {};
  let productDetailViews = 0;

  for (const row of raw.analyticsRange) {
    countryMap[row.country || 'UNKNOWN'] = (countryMap[row.country || 'UNKNOWN'] || 0) + 1;
    const date = row.created_at?.slice(0, 10);
    if (date) dailyBuckets[date] = (dailyBuckets[date] || 0) + 1;
    const match = row.path?.match(/\/products\/([^/]+)$/);
    if (match) {
      productClickMap[match[1]] = (productClickMap[match[1]] || 0) + 1;
      productDetailViews++;
    }
    const src: TrafficSource = (row.traffic_source as TrafficSource | null) ?? categorizeReferrer(row.referrer ?? null);
    if (src in sourceMap) sourceMap[src]++;
    else sourceMap.other++;

    if (SEARCH_SOURCES.has(src)) {
      const kw = row.search_keyword;
      if (kw && kw.trim() && kw !== '(not provided)') {
        const key = `${src}::${kw}`;
        const prev = keywordMap.get(key);
        if (prev) prev.count++;
        else keywordMap.set(key, { source: src, keyword: kw, count: 1 });
      }
    }
    if (row.ip_hash) {
      ipVisits[row.ip_hash] = (ipVisits[row.ip_hash] || 0) + 1;
    }
  }

  const sortedKeys = Object.keys(dailyBuckets).sort();
  const chartKeys = sortedKeys.slice(-14);
  const dailyVisits = chartKeys.map(d => ({ date: d, count: dailyBuckets[d] }));
  const uniqueVisitors = Object.keys(ipVisits).length;
  const returningVisitors = Object.values(ipVisits).filter(c => c > 1).length;

  const rangeStartMs = new Date(rangeStart).getTime();
  const rangeEndMs = new Date(rangeEnd).getTime();
  const prevStartMs = new Date(prevStart).getTime();
  const prevEndMs = new Date(prevEnd).getTime();
  // Round 32: prefer the pg-precomputed aggregates when present (RDS
  // path); fall back to walking `wishAll` for the (dead-code) supabase
  // path so the aggregator stays honest without a second migration.
  let wishlistAdds = raw.wishlistAdds ?? 0;
  let wishlistAddsPrev = raw.wishlistAddsPrev ?? 0;
  if (raw.wishlistAdds === undefined) {
    for (const w of raw.wishAll) {
      if (!w.created_at) continue;
      const t = new Date(w.created_at).getTime();
      if (t >= rangeStartMs && t < rangeEndMs) wishlistAdds++;
      else if (t >= prevStartMs && t < prevEndMs) wishlistAddsPrev++;
    }
  }

  const nameMap: Record<string, string> = {};
  for (const p of raw.productsAll) nameMap[p.id] = p.name;

  const productClicks = Object.entries(productClickMap)
    .filter(([id]) => nameMap[id])
    .map(([id, clicks]) => ({ id, name: nameMap[id], clicks }))
    .sort((a, b) => b.clicks - a.clicks);

  // Round 32: prefer the pg-precomputed top-N when present.
  const wishRanks = raw.wishRanks
    ? raw.wishRanks
        .filter(w => nameMap[w.product_id])
        .map(w => ({ id: w.product_id, name: nameMap[w.product_id], wishCount: w.wish_count }))
    : (() => {
        const wishMap: Record<string, number> = {};
        for (const w of raw.wishAll) wishMap[w.product_id] = (wishMap[w.product_id] || 0) + 1;
        return Object.entries(wishMap)
          .filter(([id]) => nameMap[id])
          .map(([id, wishCount]) => ({ id, name: nameMap[id], wishCount }))
          .sort((a, b) => b.wishCount - a.wishCount);
      })();

  const searchKeywords = Array.from(keywordMap.values())
    .map(k => ({
      source: k.source,
      sourceLabel: TRAFFIC_SOURCE_LABEL[k.source],
      keyword: k.keyword,
      count: k.count,
    }))
    .sort((a, b) => b.count - a.count);

  return {
    isLive: true,
    visits: raw.analyticsRange.length,
    newMembers: raw.usersCurr,
    wishlistAdds,
    visitsPrev: raw.analyticsPrevCount,
    newMembersPrev: raw.usersPrev,
    wishlistAddsPrev,
    activeProducts: raw.productsActive,
    totalProducts: raw.productsAll.length,
    totalMembers: raw.usersAll,
    totalWishlist: raw.wishlistTotal ?? raw.wishAll.length,
    totalVisits: raw.analyticsTotal,
    productDetailViews,
    dailyVisits,
    countries: Object.entries(countryMap)
      .map(([country, count]) => ({ country, count }))
      .sort((a, b) => b.count - a.count),
    trafficSources: (Object.keys(sourceMap) as TrafficSource[])
      .map(source => ({ source, label: TRAFFIC_SOURCE_LABEL[source], count: sourceMap[source] }))
      .sort((a, b) => b.count - a.count),
    searchKeywords,
    uniqueVisitors,
    returningVisitors,
    productClicks,
    wishRanks,
    truncated,
  };
}

/**
 * GET /api/admin/dashboard?start=ISO&end=ISO&prevStart=ISO&prevEnd=ISO
 * Returns the aggregated DashboardData. Dispatches to RDS when USE_RDS=true,
 * falls back to Supabase. Admin auth required.
 */
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(req.url);
  const rangeStart = url.searchParams.get('start');
  const rangeEnd = url.searchParams.get('end');
  const prevStart = url.searchParams.get('prevStart');
  const prevEnd = url.searchParams.get('prevEnd');
  if (!rangeStart || !rangeEnd || !prevStart || !prevEnd) {
    return NextResponse.json({ ok: false, error: 'missing range params' }, { status: 400 });
  }

  if (process.env.USE_RDS === 'true') {
    try {
      const { getDashboardRawFromPg } = await import('@/lib/db/dashboard-reads');
      const raw = await getDashboardRawFromPg(rangeStart, rangeEnd, prevStart, prevEnd);
      const data = aggregate(raw, rangeStart, rangeEnd, prevStart, prevEnd);
      return NextResponse.json({ data, source: 'rds' });
    } catch (err) {
      console.error('[admin/dashboard] pg fetch failed:', err);
      return NextResponse.json({ data: null, source: 'rds_error' }, { status: 500 });
    }
  }

  try {
    const raw = await fetchRawFromSupabase(rangeStart, rangeEnd, prevStart, prevEnd);
    const data = aggregate(raw, rangeStart, rangeEnd, prevStart, prevEnd);
    return NextResponse.json({ data, source: 'supabase' });
  } catch (err) {
    console.error('[admin/dashboard] supabase fetch failed:', err);
    return NextResponse.json({ data: null, source: 'supabase_error' }, { status: 500 });
  }
}
