import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getProducts, type Product } from '@/lib/api/products';

/**
 * Top-viewed products in the recent N-day window. Drives the storefront
 * "지금 가장 많이 본 상품" section — auto-populated from analytics rows
 * whose `path` matches `/products/{id}` over the last 7 days. The CEO
 * asked for social proof + "what's hot" surfacing without burdening the
 * admin with manual curation.
 *
 * Caches for 5 minutes — the section turns over slowly enough that
 * the operator doesn't notice staleness, and we'd rather absorb a
 * stale row than fire a Supabase query on every uncached storefront
 * render.
 */

const WINDOW_DAYS = 7;
const TOP_N = 8;
const REVALIDATE_SECONDS = 300;

async function fetchTopViewedProductsUncached(): Promise<Product[]> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return [];
  const supabase = createClient(url, key);

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString();
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
    .slice(0, TOP_N * 2)
    .map(([id]) => id);

  if (topIds.length === 0) return [];

  // getProducts hits the cached product list and applies all the same
  // filters / sort the rest of the storefront uses. Then we intersect
  // with the active set and preserve the view-count order.
  const allProducts = await getProducts();
  const byId = new Map(allProducts.map(p => [p.id, p]));
  const ordered: Product[] = [];
  for (const id of topIds) {
    const p = byId.get(id);
    if (p && p.is_active && ordered.length < TOP_N) ordered.push(p);
  }
  return ordered;
}

const cached = unstable_cache(
  fetchTopViewedProductsUncached,
  ['top-viewed-products-v1'],
  { revalidate: REVALIDATE_SECONDS, tags: ['homepage', 'analytics'] },
);

export async function getTopViewedProducts(): Promise<Product[]> {
  try {
    return await cached();
  } catch (err) {
    console.error('[topViewedProducts] failed:', err);
    return [];
  }
}
