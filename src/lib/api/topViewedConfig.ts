import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';

export interface TopViewedConfig {
  is_active: boolean;
  title_kr: string;
  title_en: string;
  subtitle_kr: string;
  subtitle_en: string;
  window_days: number;
  top_n: number;
}

const DEFAULT: TopViewedConfig = {
  is_active: true,
  title_kr: '지금 가장 많이 본 상품',
  title_en: 'TRENDING NOW',
  subtitle_kr: '최근 7일 인기',
  subtitle_en: 'Last 7 days',
  window_days: 7,
  top_n: 8,
};

function parse(raw: unknown): TopViewedConfig {
  if (!raw) return DEFAULT;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return DEFAULT; }
  }
  if (typeof obj !== 'object' || obj === null) return DEFAULT;
  const o = obj as Partial<TopViewedConfig>;
  return {
    is_active:   o.is_active === undefined ? true : o.is_active === true,
    title_kr:    typeof o.title_kr === 'string' && o.title_kr ? o.title_kr : DEFAULT.title_kr,
    title_en:    typeof o.title_en === 'string' && o.title_en ? o.title_en : DEFAULT.title_en,
    subtitle_kr: typeof o.subtitle_kr === 'string' && o.subtitle_kr ? o.subtitle_kr : DEFAULT.subtitle_kr,
    subtitle_en: typeof o.subtitle_en === 'string' && o.subtitle_en ? o.subtitle_en : DEFAULT.subtitle_en,
    window_days: typeof o.window_days === 'number' && o.window_days > 0 ? o.window_days : DEFAULT.window_days,
    top_n:       typeof o.top_n === 'number' && o.top_n > 0 ? o.top_n : DEFAULT.top_n,
  };
}

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

/**
 * Server-side fetcher for the top-viewed section config. Singleton row
 * in site_settings keyed `top_viewed_config`. Falls back to sensible
 * defaults so an un-saved (fresh install) row renders identically to
 * the pre-editor hardcoded behavior. ISR cache evicts on
 * revalidateHomepageData('top_viewed_config') from the editor save.
 */
export const getTopViewedConfig = unstable_cache(
  async (): Promise<TopViewedConfig> => {
    if (process.env.USE_RDS === 'true') {
      try {
        const { getSiteSettingFromPg } = await import('@/lib/db/storefront-reads');
        const v = await getSiteSettingFromPg('top_viewed_config');
        return parse(v);
      } catch (err) {
        console.error('[cache:top_viewed_config] RDS failed:', err);
        return DEFAULT;
      }
    }
    const c = client();
    if (!c) return DEFAULT;
    try {
      const { data, error } = await c
        .from('site_settings')
        .select('value')
        .eq('key', 'top_viewed_config')
        .maybeSingle();
      if (error || !data) return DEFAULT;
      return parse(data.value);
    } catch (err) {
      console.error('[cache:top_viewed_config] failed:', err);
      return DEFAULT;
    }
  },
  ['homepage:top_viewed_config'],
  { revalidate: 60, tags: ['homepage', 'top_viewed_config'] },
);
