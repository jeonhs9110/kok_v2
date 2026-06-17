import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export interface HomepageBanner {
  id: string;
  text: Record<string, string>;
  link_url: string | null;
  bg_color: string;
  text_color: string;
  is_active: boolean;
}

const DEFAULTS = {
  bg_color: '#1f2937',
  text_color: '#ffffff',
};

// unstable_cache (not React cache()) so that revalidateHomepageData
// tag updates from /admin/banners/[id] actually evict the storefront
// data. Previously the fetcher used React cache() which only dedups
// within a single render — invalidate.ts's updateTag('homepage_banners')
// call was therefore a no-op and the storefront kept serving the stale
// row until the next 60s ISR pass.
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

export const getHomepageBanners = unstable_cache(
  async (): Promise<HomepageBanner[]> => {
    const c = client();
    if (!c) return [];
    try {
      const { data, error } = await c
        .from('homepage_banners')
        .select('id,text,link_url,bg_color,text_color,is_active');
      if (error || !data) return [];
      return data.map(row => ({
        id: row.id,
        text: typeof row.text === 'object' && row.text !== null ? row.text : {},
        link_url: row.link_url || null,
        bg_color: row.bg_color || DEFAULTS.bg_color,
        text_color: row.text_color || DEFAULTS.text_color,
        is_active: row.is_active ?? true,
      }));
    } catch (err) {
      console.error('[cache:homepage_banners] failed:', err);
      return [];
    }
  },
  ['homepage:banners'],
  { revalidate: 60, tags: ['homepage', 'homepage_banners'] },
);
