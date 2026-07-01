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
  /**
   * Round 32: legacy field, always empty array. Kept in the shape so
   * older callers that iterated it don't crash. Consumers should read
   * the precomputed aggregates below.
   */
  wishAll: DashboardWishlistRow[];
  wishlistTotal: number;
  wishlistAdds: number;
  wishlistAddsPrev: number;
  wishRanks: Array<{ product_id: string; wish_count: number }>;
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
    wishTop,
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
    // Round 32: use pg_class.reltuples (approximate row count updated by
    // VACUUM/ANALYZE) instead of a full-table COUNT(*). analytics is the
    // fastest-growing table on the site and the "total events across all
    // time" KPI is cosmetic — off by ~5% between VACUUMs is acceptable
    // vs. paying an all-rows scan on every dashboard load.
    pool.query<{ n: string }>(`SELECT reltuples::bigint::text AS n FROM pg_class WHERE relname = 'analytics'`),
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
    // Round 32: wishlist aggregates — three cheap queries replacing the
    // prior unbounded `SELECT product_id, created_at FROM wishlist`.
    // At 100k+ hearts (plausible organic scale for a live storefront)
    // that unbounded scan pulled every row into Node on every dashboard
    // load; now we get (total, range counts, top 50) directly from pg.
    pool.query<{ total: string; range: string; prev: string }>(
      `SELECT COUNT(*)::text AS total,
              COUNT(*) FILTER (WHERE created_at >= $1 AND created_at < $2)::text AS range,
              COUNT(*) FILTER (WHERE created_at >= $3 AND created_at < $4)::text AS prev
         FROM public.wishlist`,
      [rangeStart, rangeEnd, prevStart, prevEnd],
    ),
    pool.query<{ product_id: string; wish_count: string }>(
      `SELECT product_id, COUNT(*)::text AS wish_count
         FROM public.wishlist
        GROUP BY product_id
        ORDER BY COUNT(*) DESC
        LIMIT 50`,
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
    // Round 32: precomputed wishlist aggregates. The old shape
    // (`DashboardWishlistRow[]`) is still returned as `wishAll` for
    // caller compatibility — see the aggregator inline below —
    // and now this shape carries the counts directly.
    wishAll: [],
    wishlistTotal: Number(wishAll.rows[0]?.total ?? 0),
    wishlistAdds: Number(wishAll.rows[0]?.range ?? 0),
    wishlistAddsPrev: Number(wishAll.rows[0]?.prev ?? 0),
    wishRanks: wishTop.rows.map(r => ({ product_id: r.product_id, wish_count: Number(r.wish_count) })),
  };
}
