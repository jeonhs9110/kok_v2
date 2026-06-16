import { cache } from 'react';
import { supabase } from '@/lib/api/products';
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
 * Server-side fetcher for the top-stripe banner config. Same pattern
 * as getThemeTokens — React cache() for per-render dedup, falls back
 * to a safe default (banner hidden) on any error.
 */
export const getTopStripe = cache(async (): Promise<TopStripeBannerData> => {
  if (!supabase) return DEFAULT;
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'top_stripe')
      .maybeSingle();
    if (error || !data) return DEFAULT;
    return parse(data.value);
  } catch {
    return DEFAULT;
  }
});
