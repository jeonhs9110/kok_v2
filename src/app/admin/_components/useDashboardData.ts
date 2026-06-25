import { useEffect, useMemo, useState } from 'react';
import { type TrafficSource } from '@/lib/analytics/referrer';

export type { TrafficSource };

export type DashboardSource = 'rds' | 'supabase' | 'rds_error' | 'supabase_error' | null;

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
  visits: number;
  newMembers: number;
  wishlistAdds: number;
  visitsPrev: number;
  newMembersPrev: number;
  wishlistAddsPrev: number;
  activeProducts: number;
  totalProducts: number;
  totalMembers: number;
  totalWishlist: number;
  totalVisits: number;
  productDetailViews: number;
  uniqueVisitors: number;
  returningVisitors: number;
  dailyVisits: { date: string; count: number }[];
  countries: { country: string; count: number }[];
  trafficSources: { source: TrafficSource; label: string; count: number }[];
  searchKeywords: SearchKeywordRow[];
  productClicks: { id: string; name: string; clicks: number }[];
  wishRanks: { id: string; name: string; wishCount: number }[];
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
 * Cafe24-style dashboard data hook. Thin client wrapper around
 * /api/admin/dashboard — that route runs the 9 parallel queries +
 * aggregation server-side and dispatches by USE_RDS.
 */
export function useDashboardData() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset('7d'));
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<DashboardSource>(null);

  async function fetchAll(forRange: DateRange = range) {
    setIsLoading(true);
    try {
      const rangeMs = new Date(forRange.end).getTime() - new Date(forRange.start).getTime();
      const prevStart = new Date(new Date(forRange.start).getTime() - rangeMs).toISOString();
      const prevEnd = forRange.start;

      const params = new URLSearchParams({
        start: forRange.start,
        end: forRange.end,
        prevStart,
        prevEnd,
      });
      const res = await fetch(`/api/admin/dashboard?${params}`, { cache: 'no-store' });
      const json = (await res.json()) as { data?: DashboardData | null; source?: DashboardSource };
      setSource(json.source ?? null);
      if (json.data) setData(json.data);
      // On error: leave previous data alone so the operator sees stale
      // data + a refresh button instead of a zeroed-out wipe.
    } catch (err) {
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

  return { data, isLoading, range, setRange, presets, source, fetchAll: () => fetchAll(range) };
}
