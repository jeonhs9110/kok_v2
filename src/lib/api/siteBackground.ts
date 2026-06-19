import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export interface ActiveSiteBackground {
  file_url: string;
  file_type: 'image' | 'video';
  scroll_driven?: boolean;
}

/**
 * Server-side fetcher for the one active site_backgrounds row.
 *
 * Previously fetched client-side from <SiteBackground> on every mount
 * (~1.3s blocking call per page load). The row changes when the admin
 * uploads a new background — minutes apart at most — so unstable_cache
 * with revalidate: 60 + tag eviction on save gives the storefront a
 * cached read for free.
 */
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

export const getActiveSiteBackground = unstable_cache(
  async (): Promise<ActiveSiteBackground | null> => {
    const c = client();
    if (!c) return null;
    try {
      const { data, error } = await c
        .from('site_backgrounds')
        .select('file_url, file_type, scroll_driven')
        .eq('is_active', true)
        .maybeSingle();
      if (error || !data) return null;
      return data as ActiveSiteBackground;
    } catch (err) {
      console.error('[cache:site_background] failed:', err);
      return null;
    }
  },
  ['site_background:active'],
  { revalidate: 60, tags: ['site_background'] },
);
