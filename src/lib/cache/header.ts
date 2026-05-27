// Server-side fetchers for the data the Header needs to render without
// a client-side hydration flicker. Layout fetches these on the server
// and passes them down as initial-state props.
//
// Note: previous version wrapped these with `unstable_cache` for 60s
// memoization, but that returned empty arrays on the deployed build
// even when the underlying queries worked (still investigating why —
// possibly a Next.js 16 turbopack interaction). Plain async functions
// add ~50ms per page load but reliably return live data.

import { getMenuTree, type MenuWithChildren } from '@/lib/api/menus';
import { getCategoriesTree, type CategoryWithChildren } from '@/lib/api/categories';
import { getSiteSetting } from '@/lib/api/site-settings';

export async function getCachedNavMenus(): Promise<MenuWithChildren[]> {
  try {
    const tree = await getMenuTree();
    return tree.filter(m => m.show_in_nav);
  } catch {
    return [];
  }
}

export async function getCachedCategoriesTree(): Promise<CategoryWithChildren[]> {
  try {
    return await getCategoriesTree();
  } catch {
    return [];
  }
}

export async function getCachedLogoUrl(): Promise<string> {
  try {
    const url = await getSiteSetting('logo_url');
    return url || '/kokkokgarden_primary.svg';
  } catch {
    return '/kokkokgarden_primary.svg';
  }
}
