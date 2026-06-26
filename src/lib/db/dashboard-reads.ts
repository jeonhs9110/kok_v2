// See src/lib/db/pool.ts for why 'server-only' is intentionally absent.
import { getPgPool } from './pool';

/**
 * Pg helpers for the /admin dashboard. Mirrors the 9 parallel supabase
 * queries in useDashboardData.ts so the dispatcher in /api/admin/dashboard
 * can pick the pg path when USE_RDS=true.
 */

export interface DashboardRangeRow {
  country: string | null;
  path: string | null;
  referrer: string | null;
  traffic_source: string | null;
  search_keyword: string | null;
  created_at: string;
  ip_hash: string | null;
}

export interface DashboardProductRow {
  id: string;
  name: string;
  is_active: boolean;
  images: string[] | null;
}

export interface DashboardWishlistRow {
  product_id: string;
  created_at: string;
}

export interface DashboardRawData {
  analyticsRange: DashboardRangeRow[];
  analyticsTotal: number;
  analyticsPrevCount: number;
  productsAll: DashboardProductRow[];
  productsActive: number;
  usersAll: number;
  usersCurr: number;
  usersPrev: number;
  wishAll: DashboardWishlistRow[];
}

const RAW_LIMIT = 20000;

// ─── /admin/analytics raw rows ────────────────────────────────────
export interface AnalyticsRawRow {
  path: string | null;
  referrer: string | null;
  traffic_source: string | null;
  search_keyword: string | null;
  created_at: string;
  ip_hash: string | null;
  device_type: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

export interface AnalyticsPriorRow {
  path: string | null;
  created_at: string;
  ip_hash: string | null;
}

export interface AnalyticsRawData {
  analyticsRange: AnalyticsRawRow[];
  analyticsPrior: AnalyticsPriorRow[];
  productsAll: Array<{ id: string; name: string }>;
}

export async function getAnalyticsRawFromPg(
  rangeStart: string,
  rangeEnd: string,
  priorStart: string,
  priorEnd: string,
): Promise<AnalyticsRawData> {
  const pool = getPgPool();
  const [analyticsRange, analyticsPrior, productsAll] = await Promise.all([
    pool.query<AnalyticsRawRow>(
      `SELECT path, referrer, traffic_source, search_keyword,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
              ip_hash, device_type, utm_source, utm_medium, utm_campaign
         FROM public.analytics
        WHERE created_at >= $1 AND created_at < $2
        ORDER BY created_at DESC
        LIMIT $3`,
      [rangeStart, rangeEnd, RAW_LIMIT],
    ),
    pool.query<AnalyticsPriorRow>(
      `SELECT path,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
              ip_hash
         FROM public.analytics
        WHERE created_at >= $1 AND created_at < $2
        ORDER BY created_at DESC
        LIMIT $3`,
      [priorStart, priorEnd, RAW_LIMIT],
    ),
    pool.query<{ id: string; name: string }>(
      `SELECT id, name FROM public.products`,
    ),
  ]);
  return {
    analyticsRange: analyticsRange.rows,
    analyticsPrior: analyticsPrior.rows,
    productsAll: productsAll.rows,
  };
}

export async function getDashboardRawFromPg(
  rangeStart: string,
  rangeEnd: string,
  prevStart: string,
  prevEnd: string,
): Promise<DashboardRawData> {
  const pool = getPgPool();
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
    // created_at is cast to text so the aggregation code can call
    // .slice() on it — pg's default mapping returns Date objects which
    // would crash the dispatcher.
    pool.query<DashboardRangeRow>(
      `SELECT country, path, referrer, traffic_source, search_keyword,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at,
              ip_hash
         FROM public.analytics
        WHERE created_at >= $1 AND created_at < $2
        ORDER BY created_at DESC
        LIMIT $3`,
      [rangeStart, rangeEnd, RAW_LIMIT],
    ),
    pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM public.analytics`),
    pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.analytics
        WHERE created_at >= $1 AND created_at < $2`,
      [prevStart, prevEnd],
    ),
    pool.query<DashboardProductRow>(
      `SELECT id, name, is_active, images FROM public.products`,
    ),
    pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.products WHERE is_active = true`,
    ),
    pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM public.users`),
    pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.users
        WHERE created_at >= $1 AND created_at < $2`,
      [rangeStart, rangeEnd],
    ),
    pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM public.users
        WHERE created_at >= $1 AND created_at < $2`,
      [prevStart, prevEnd],
    ),
    pool.query<DashboardWishlistRow>(
      `SELECT product_id,
              to_char(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS created_at
         FROM public.wishlist`,
    ),
  ]);

  return {
    analyticsRange: analyticsRange.rows,
    analyticsTotal: Number(analyticsTotal.rows[0]?.n ?? 0),
    analyticsPrevCount: Number(analyticsPrevCount.rows[0]?.n ?? 0),
    productsAll: productsAll.rows,
    productsActive: Number(productsActive.rows[0]?.n ?? 0),
    usersAll: Number(usersAll.rows[0]?.n ?? 0),
    usersCurr: Number(usersCurr.rows[0]?.n ?? 0),
    usersPrev: Number(usersPrev.rows[0]?.n ?? 0),
    wishAll: wishAll.rows,
  };
}
