import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import {
  categorizeReferrer,
  TRAFFIC_SOURCE_LABEL,
  SEARCH_SOURCES,
  type TrafficSource,
} from '@/lib/analytics/referrer';

const supabase = getSupabaseBrowser();

export type { TrafficSource };

/**
 * Date-range presets surfaced in the admin UI. `custom` lets the operator
 * type any pair of dates. Defaults to `7d` so the first load matches what
 * Cafe24-style dashboards show out of the box.
 */
export type RangePreset = 'today' | '7d' | '30d' | '90d' | 'custom';

export interface DateRange {
  preset: RangePreset;
  /** ISO start (inclusive) of the current window. */
  start: string;
  /** ISO end (exclusive) of the current window. */
  end: string;
  /** Korean label shown in the dashboard header. */
  label: string;
}

export interface SearchKeywordRow {
  source: TrafficSource;
  sourceLabel: string;
  keyword: string;
  count: number;
}

export interface DashboardData {
  isLive: boolean;
  /** Visits inside the selected date range. */
  visits: number;
  newMembers: number;
  wishlistAdds: number;
  /** Same metrics in the same-length window immediately before. */
  visitsPrev: number;
  newMembersPrev: number;
  wishlistAddsPrev: number;
  // current totals (all-time)
  activeProducts: number;
  totalProducts: number;
  totalMembers: number;
  totalWishlist: number;
  totalVisits: number;
  productDetailViews: number;
  // visitor uniqueness inside the selected range — derived from analytics.ip_hash
  uniqueVisitors: number;
  returningVisitors: number;
  // breakdowns inside the selected range
  dailyVisits: { date: string; count: number }[];
  countries: { country: string; count: number }[];
  trafficSources: { source: TrafficSource; label: string; count: number }[];
  searchKeywords: SearchKeywordRow[];
  productClicks: { id: string; name: string; clicks: number }[];
  wishRanks: { id: string; name: string; wishCount: number }[];
  /** True when the raw analytics query hit its row cap and dropped older rows. */
  truncated: boolean;
}

export const EMPTY: DashboardData = {
  isLive: false,
  visits: 0, newMembers: 0, wishlistAdds: 0,
  visitsPrev: 0, newMembersPrev: 0, wishlistAddsPrev: 0,
  activeProducts: 0, totalProducts: 0, totalMembers: 0, totalWishlist: 0,
  totalVisits: 0, productDetailViews: 0,
  uniqueVisitors: 0, returningVisitors: 0,
  dailyVisits: [], countries: [], trafficSources: [], searchKeywords: [],
  productClicks: [], wishRanks: [],
  truncated: false,
};

const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Per-fetch row cap on the analytics raw pull. Big enough that 90 days at
 * the current ~200 visits/day still fits whole; small enough that the
 * browser-side reducer doesn't OOM on bursty months. If we cross ~18K rows
 * the dashboard sets `truncated: true` so the operator sees a notice
 * instead of silently-clipped numbers.
 */
const RAW_LIMIT = 20000;

function fmt(d: Date): string {
  return d.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

/**
 * Build a DateRange from a preset. `today` covers from local midnight to
 * now. The numbered presets are rolling N-day windows ending at "now"
 * (Cafe24's convention) — using local midnight for the start lines up
 * better with daily bucketing.
 */
export function rangeFromPreset(preset: Exclude<RangePreset, 'custom'>): DateRange {
  const now = new Date();
  const end = now.toISOString();
  let start: Date;
  let label: string;
  if (preset === 'today') {
    start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    label = `오늘 (${fmt(start)})`;
  } else {
    const days = preset === '7d' ? 7 : preset === '30d' ? 30 : 90;
    start = new Date(Date.now() - days * DAY_MS);
    label = `${fmt(start)} – ${fmt(now)} (최근 ${days}일)`;
  }
  return { preset, start: start.toISOString(), end, label };
}

/**
 * Build a custom DateRange from two YYYY-MM-DD strings. Treats the end
 * date as inclusive — we add a day so the query's lt('created_at', end)
 * still captures rows from the end day itself.
 */
export function rangeFromCustom(startYmd: string, endYmd: string): DateRange {
  const startDate = new Date(`${startYmd}T00:00:00`);
  const endExclusive = new Date(`${endYmd}T00:00:00`);
  endExclusive.setDate(endExclusive.getDate() + 1);
  return {
    preset: 'custom',
    start: startDate.toISOString(),
    end: endExclusive.toISOString(),
    label: `${fmt(startDate)} – ${fmt(new Date(`${endYmd}T00:00:00`))} (직접 선택)`,
  };
}

/**
 * Cafe24-style dashboard data hook. Pulls a range-bounded slice of
 * analytics + the supporting tables (products, users, wishlist) in
 * parallel, then aggregates client-side. Visit / member / wishlist
 * metrics also fetch a "previous-window" count of the same length so
 * the StatCards can show trend %.
 *
 * For each analytics row, the bucket comes from `traffic_source` when
 * present (PR-A onwards). Legacy rows where the column is NULL fall
 * back to categorizeReferrer() on the text referrer so historical data
 * still shows up. Keyword aggregation uses `search_keyword` when
 * present and falls back to URL-parsing the referrer otherwise.
 */
export function useDashboardData() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset('7d'));
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchAll(forRange: DateRange = range) {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('No client');

      const rangeMs = new Date(forRange.end).getTime() - new Date(forRange.start).getTime();
      const prevStart = new Date(new Date(forRange.start).getTime() - rangeMs).toISOString();
      const prevEnd = forRange.start;

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
          .gte('created_at', forRange.start)
          .lt('created_at', forRange.end)
          .order('created_at', { ascending: false })
          .limit(RAW_LIMIT),
        supabase.from('analytics').select('id', { count: 'exact', head: true }),
        supabase
          .from('analytics')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', prevStart)
          .lt('created_at', prevEnd),
        supabase.from('products').select('id, name, is_active, images'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', forRange.start)
          .lt('created_at', forRange.end),
        supabase
          .from('users')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', prevStart)
          .lt('created_at', prevEnd),
        supabase.from('wishlist').select('product_id, created_at'),
      ]);

      const rangeRows = analyticsRange.data ?? [];
      const truncated = rangeRows.length >= RAW_LIMIT;

      // Daily-visit bucketing for the range. The chart only renders the
      // last 14 day-keys regardless of window length (any wider and the
      // bars become unreadable on the panel), but we still bucket the
      // full range so the totals across the chart match the StatCard.
      const dailyBuckets: Record<string, number> = {};
      const countryMap: Record<string, number> = {};
      const productClickMap: Record<string, number> = {};
      const sourceMap = {} as Record<TrafficSource, number>;
      (Object.keys(TRAFFIC_SOURCE_LABEL) as TrafficSource[]).forEach(s => { sourceMap[s] = 0; });
      const keywordMap = new Map<string, { source: TrafficSource; keyword: string; count: number }>();
      const ipVisits: Record<string, number> = {};
      let productDetailViews = 0;

      for (const row of rangeRows) {
        countryMap[row.country || 'UNKNOWN'] = (countryMap[row.country || 'UNKNOWN'] || 0) + 1;
        const date = row.created_at?.slice(0, 10);
        if (date) dailyBuckets[date] = (dailyBuckets[date] || 0) + 1;
        const match = row.path?.match(/\/products\/([^/]+)$/);
        if (match) {
          productClickMap[match[1]] = (productClickMap[match[1]] || 0) + 1;
          productDetailViews++;
        }
        // Prefer the persisted bucket (PR-A onwards); fall back to the
        // shared parser on the raw referrer string for legacy rows.
        const src: TrafficSource = (row.traffic_source as TrafficSource | null) ?? categorizeReferrer(row.referrer ?? null);
        if (src in sourceMap) sourceMap[src]++;
        else sourceMap.other++;

        if (SEARCH_SOURCES.has(src)) {
          const kw = (row.search_keyword as string | null) ?? null;
          // Only count non-empty, non-"(not provided)" keywords. We
          // explicitly drop nulls so the panel doesn't lead with an
          // anonymous "(no keyword)" row that swamps real data.
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

      // Build a continuous date axis for the chart. We trim to the most
      // recent 14 day-buckets so a 90-day pull doesn't paint 90 slim bars.
      const sortedKeys = Object.keys(dailyBuckets).sort();
      const chartKeys = sortedKeys.slice(-14);
      const dailyVisits = chartKeys.map(d => ({ date: d, count: dailyBuckets[d] }));
      const uniqueVisitors = Object.keys(ipVisits).length;
      const returningVisitors = Object.values(ipVisits).filter(c => c > 1).length;

      // Wishlist windowing — the wishlist table is small enough to scan
      // entirely (Phase 1 ~hundreds of rows), so we filter client-side.
      const rangeStartMs = new Date(forRange.start).getTime();
      const rangeEndMs = new Date(forRange.end).getTime();
      const prevStartMs = new Date(prevStart).getTime();
      const prevEndMs = new Date(prevEnd).getTime();
      let wishlistAdds = 0;
      let wishlistAddsPrev = 0;
      for (const w of wishAll.data ?? []) {
        if (!w.created_at) continue;
        const t = new Date(w.created_at).getTime();
        if (t >= rangeStartMs && t < rangeEndMs) wishlistAdds++;
        else if (t >= prevStartMs && t < prevEndMs) wishlistAddsPrev++;
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

      const searchKeywords: SearchKeywordRow[] = Array.from(keywordMap.values())
        .map(k => ({
          source: k.source,
          sourceLabel: TRAFFIC_SOURCE_LABEL[k.source],
          keyword: k.keyword,
          count: k.count,
        }))
        .sort((a, b) => b.count - a.count);

      setData({
        isLive: true,
        visits: rangeRows.length,
        newMembers: usersCurr.count ?? 0,
        wishlistAdds,
        visitsPrev: analyticsPrevCount.count ?? 0,
        newMembersPrev: usersPrev.count ?? 0,
        wishlistAddsPrev,
        activeProducts: productsActive.count ?? 0,
        totalProducts: productsAll.data?.length ?? 0,
        totalMembers: usersAll.count ?? 0,
        totalWishlist: wishAll.data?.length ?? 0,
        totalVisits: analyticsTotal.count ?? 0,
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
      });
    } catch (err) {
      // Leave the previous data alone so the operator sees stale data
      // + a refresh button instead of a zeroed-out wipe.
      console.error('[dashboard] fetchAll failed:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchAll(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  const presets = useMemo(
    () => ({
      today: rangeFromPreset('today'),
      '7d': rangeFromPreset('7d'),
      '30d': rangeFromPreset('30d'),
      '90d': rangeFromPreset('90d'),
    }),
    [],
  );

  return { data, isLoading, range, setRange, presets, fetchAll: () => fetchAll(range) };
}
