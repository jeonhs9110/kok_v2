// Server-side cached fetchers for the data the Header needs to render
// without a client-side hydration flicker. Layout fetches these on the
// server and passes them down as initial-state props.
//
// 60-second revalidate matches lib/cache/homepage.ts — admin edits to
// menus/categories/logo become visible within ~1min without a deploy.

import { unstable_cache } from 'next/cache';
import { getMenuTree, type MenuWithChildren } from '@/lib/api/menus';
import { getCategoriesTree, type CategoryWithChildren } from '@/lib/api/categories';
import { getSiteSetting } from '@/lib/api/site-settings';

const REVALIDATE = 60;

export const getCachedNavMenus = unstable_cache(
  async (): Promise<MenuWithChildren[]> => {
    try {
      const tree = await getMenuTree();
      return tree.filter(m => m.show_in_nav);
    } catch {
      return [];
    }
  },
  ['header:nav-menus'],
  { revalidate: REVALIDATE, tags: ['header', 'menus'] }
);

export const getCachedCategoriesTree = unstable_cache(
  async (): Promise<CategoryWithChildren[]> => {
    try {
      return await getCategoriesTree();
    } catch {
      return [];
    }
  },
  ['header:categories-tree'],
  { revalidate: REVALIDATE, tags: ['header', 'categories'] }
);

export const getCachedLogoUrl = unstable_cache(
  async (): Promise<string> => {
    try {
      const url = await getSiteSetting('logo_url');
      return url || '/kokkokgarden_primary.svg';
    } catch {
      return '/kokkokgarden_primary.svg';
    }
  },
  ['header:logo-url'],
  { revalidate: REVALIDATE, tags: ['header', 'site_settings'] }
);
