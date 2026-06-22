import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import type { TopStripeBannerData } from '@/components/TopStripeBanner';

const DEFAULT: TopStripeBannerData = {
  is_active: false,
  text: '',
  link_url: '',
  bg_color: '#1f2937',
  text_color: '#ffffff',
};

function parse(raw: unknown): TopStripeBannerData {
  if (!raw) return DEFAULT;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return DEFAULT; }
  }
  if (typeof obj !== 'object' || obj === null) return DEFAULT;
  const o = obj as Partial<TopStripeBannerData>;
  return {
    is_active: o.is_active === true,
    text:       typeof o.text === 'string' ? o.text : '',
    link_url:   typeof o.link_url === 'string' ? o.link_url : '',
    bg_color:   typeof o.bg_color === 'string' && o.bg_color ? o.bg_color : DEFAULT.bg_color,
    text_color: typeof o.text_color === 'string' && o.text_color ? o.text_color : DEFAULT.text_color,
  };
}

/**
 * Server-side fetcher for the top-stripe banner config.
 *
 * Uses unstable_cache (not React cache()) so the matching
 * revalidateHomepageData('top_stripe') call from /admin/top-stripe
 * actually evicts this entry. React cache() only dedups within a
 * single render and ignores updateTag — the previous implementation
 * left the admin save as a visible no-op until the next 60s ISR.
 */
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

export const getTopStripe = unstable_cache(
  async (): Promise<TopStripeBannerData> => {
    if (process.env.USE_RDS === 'true') {
      try {
        const { getSiteSettingFromPg } = await import('@/lib/db/storefront-reads');
        const v = await getSiteSettingFromPg('top_stripe');
        return parse(v);
      } catch (err) {
        console.error('[cache:top_stripe] RDS failed:', err);
        return DEFAULT;
      }
    }
    const c = client();
    if (!c) return DEFAULT;
    try {
      const { data, error } = await c
        .from('site_settings')
        .select('value')
        .eq('key', 'top_stripe')
        .maybeSingle();
      if (error || !data) return DEFAULT;
      return parse(data.value);
    } catch (err) {
      console.error('[cache:top_stripe] failed:', err);
      return DEFAULT;
    }
  },
  ['homepage:top_stripe'],
  { revalidate: 60, tags: ['homepage', 'top_stripe'] },
);
