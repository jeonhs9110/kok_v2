import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getProducts, type Product } from '@/lib/api/products';
import { USE_RDS } from '@/lib/db/pool';

/**
 * Top-viewed products in the recent N-day window. Drives the storefront
 * "지금 가장 많이 본 상품" section — auto-populated from analytics rows
 * whose `path` matches `/products/{id}` over the configured window.
 *
 * Window + count come from `site_settings.top_viewed_config` (admin
 * editor at /admin/top-viewed). Defaults: 7 days, top 8. Cached for
 * 5 minutes; the section turns over slowly so absorbing 5 minutes of
 * staleness beats firing a query on every uncached storefront render.
 *
 * Data backend dispatches on USE_RDS — RDS path was wired 2026-06-29
 * after the audit caught the post-cutover Supabase-only read.
 */

const DEFAULT_WINDOW_DAYS = 7;
const DEFAULT_TOP_N = 8;
const REVALIDATE_SECONDS = 300;

interface FetchOptions {
  windowDays: number;
  topN: number;
}

async function fetchTopViewedFromRds(opts: FetchOptions): Promise<Product[]> {
  const { getPgPool } = await import('@/lib/db/pool');
  const pool = getPgPool();
  const since = new Date(Date.now() - opts.windowDays * 24 * 60 * 60 * 1000).toISOString();
  // Extract the product id from `path` once on the DB side rather than
  // pulling tens of thousands of rows back and counting in JS.
  // Postgres regex_match returns an array; pick the captured group.
  const { rows } = await pool.query<{ product_id: string; views: string }>(
    `SELECT (regexp_match(path, '/products/([^/]+)$'))[1] AS product_id,
            COUNT(*)::text AS views
       FROM public.analytics
      WHERE created_at >= $1
        AND path LIKE '%/products/%'
        AND (regexp_match(path, '/products/([^/]+)$'))[1] IS NOT NULL
      GROUP BY product_id
      ORDER BY COUNT(*) DESC
      LIMIT $2`,
    [since, opts.topN * 2],
  );
  return await orderByIds(rows.map(r => r.product_id), opts.topN);
}

async function fetchTopViewedFromSupabase(opts: FetchOptions): Promise<Product[]> {
  // Legacy fallback for pre-cutover environments. Once USE_RDS sticks at
  // true across all deploys, this branch is dead and can be deleted.
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const supabase = createClient(url, key);

  const since = new Date(Date.now() - opts.windowDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('analytics')
    .select('path')
    .gte('created_at', since)
    .like('path', '%/products/%')
    .limit(20000);
  if (error) throw error;

  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    const match = row.path?.match(/\/products\/([^/]+)$/);
    if (!match) continue;
    counts.set(match[1], (counts.get(match[1]) ?? 0) + 1);
  }

  const topIds = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, opts.topN * 2)
    .map(([id]) => id);
  return await orderByIds(topIds, opts.topN);
}

async function orderByIds(topIds: string[], topN: number): Promise<Product[]> {
  if (topIds.length === 0) return [];
  const allProducts = await getProducts();
  const byId = new Map(allProducts.map(p => [p.id, p]));
  const ordered: Product[] = [];
  for (const id of topIds) {
    const p = byId.get(id);
    if (p && p.is_active && ordered.length < topN) ordered.push(p);
  }
  return ordered;
}

async function fetchTopViewedProductsUncached(opts: FetchOptions): Promise<Product[]> {
  if (USE_RDS) return fetchTopViewedFromRds(opts);
  return fetchTopViewedFromSupabase(opts);
}

// Cache key includes the options so different window/count tuples don't
// share a cache entry — operator changes from "7d / 8" to "30d / 16"
// re-fetches instead of returning stale data from the prior config.
function cachedFor(opts: FetchOptions) {
  return unstable_cache(
    () => fetchTopViewedProductsUncached(opts),
    ['top-viewed-products-v2', `w${opts.windowDays}-n${opts.topN}`],
    { revalidate: REVALIDATE_SECONDS, tags: ['homepage', 'analytics', 'top_viewed_config'] },
  );
}

export async function getTopViewedProducts(opts?: Partial<FetchOptions>): Promise<Product[]> {
  const resolved: FetchOptions = {
    windowDays: opts?.windowDays ?? DEFAULT_WINDOW_DAYS,
    topN: opts?.topN ?? DEFAULT_TOP_N,
  };
  try {
    return await cachedFor(resolved)();
  } catch (err) {
    console.error('[topViewedProducts] failed:', err);
    return [];
  }
}
