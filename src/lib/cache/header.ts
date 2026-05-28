// Server-side fetchers for the data the Header needs to render without
// a client-side hydration flicker. Layout fetches these on the server
// and passes them down as initial-state props.
//
// Caching strategy (revised after PR #56 fallout):
//
//   1. React `cache()` — dedupes within a single request. If three
//      components in the same SSR pass each call `getCachedNavMenus()`,
//      Supabase is hit ONCE. This is the cheap layer.
//
//   2. Process-local TTL memo — survives across requests for `TTL_MS`.
//      Skips the Supabase round-trip entirely for 99% of requests
//      between admin edits. Per-instance (not shared across the ALB),
//      which is the right granularity since each EC2 boots a fresh
//      memo from cold-start.
//
// The previous version wrapped these with `unstable_cache`, but that
// turned out to capture a stale Supabase client at module-init time
// (or hit a Next.js 16 turbopack bug — never fully isolated) and
// returned empty arrays on the deployed build even when the underlying
// queries worked. The `cache()` + memo combo gives us the same
// effective freshness without the Next-internal cache layer.
//
// Invalidation: admin pages that mutate header data call
// `revalidateHeaderData()` from `@/lib/cache/invalidate` to clear the
// memo. Until then, the freshest update can lag by up to TTL_MS.

import { cache } from 'react';
import { getMenuTree, type MenuWithChildren } from '@/lib/api/menus';
import { getCategoriesTree, type CategoryWithChildren } from '@/lib/api/categories';
import { getSiteSetting } from '@/lib/api/site-settings';

const TTL_MS = 60_000;

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

const memo = new Map<string, CacheEntry<unknown>>();

async function memoized<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key) as CacheEntry<T> | undefined;
  if (hit && hit.expiresAt > Date.now()) return hit.value;
  const value = await fn();
  memo.set(key, { value, expiresAt: Date.now() + TTL_MS });
  return value;
}

// Called by admin mutations (revalidateHeaderData → here) to evict the
// memo so the next render sees fresh data instead of waiting on TTL.
export function clearHeaderMemo(): void {
  memo.clear();
}

export const getCachedNavMenus = cache(async (): Promise<MenuWithChildren[]> => {
  return memoized('nav', async () => {
    try {
      const tree = await getMenuTree();
      return tree.filter(m => m.show_in_nav);
    } catch {
      return [];
    }
  });
});

export const getCachedCategoriesTree = cache(async (): Promise<CategoryWithChildren[]> => {
  return memoized('categories', async () => {
    try {
      return await getCategoriesTree();
    } catch {
      return [];
    }
  });
});

export const getCachedLogoUrl = cache(async (): Promise<string> => {
  return memoized('logo', async () => {
    try {
      const url = await getSiteSetting('logo_url');
      return url || '/kokkokgarden_primary.svg';
    } catch {
      return '/kokkokgarden_primary.svg';
    }
  });
});
