import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { DEFAULT_THEME_TOKENS, parseThemeTokens, type ThemeTokens } from './tokens';

/**
 * Server-side fetcher for the persisted theme tokens. Falls back to the
 * baked-in defaults if the row doesn't exist or the JSON is malformed,
 * so the storefront never breaks because of a bad admin input.
 *
 * Wrapped in unstable_cache (60s + tag eviction) — previously used React
 * cache() which only dedups within ONE render and hit Supabase on every
 * fresh request. Admin saves at /admin/theme and /admin/best-seller-display
 * should call revalidateTag('theme_tokens') to drop the cached value.
 *
 * 2026-06-29: added the USE_RDS dispatcher. Pre-fix this read hit
 * Supabase unconditionally, so every theme edit landing in RDS post-
 * cutover was invisible to the storefront — the site has been rendering
 * the frozen 2026-06-27 token snapshot for 3 days (colors, fonts,
 * spacings, the entire visual system).
 */
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

export const getThemeTokens = unstable_cache(
  async (): Promise<ThemeTokens> => {
    if (process.env.USE_RDS === 'true') {
      try {
        const { getSiteSettingFromPg } = await import('@/lib/db/storefront-reads');
        const v = await getSiteSettingFromPg('theme_tokens');
        return parseThemeTokens(v);
      } catch (err) {
        console.error('[cache:theme_tokens] RDS failed:', err);
        return DEFAULT_THEME_TOKENS;
      }
    }
    const c = client();
    if (!c) return DEFAULT_THEME_TOKENS;
    try {
      const { data, error } = await c
        .from('site_settings')
        .select('value')
        .eq('key', 'theme_tokens')
        .maybeSingle();
      if (error || !data) return DEFAULT_THEME_TOKENS;
      return parseThemeTokens(data.value);
    } catch {
      return DEFAULT_THEME_TOKENS;
    }
  },
  ['theme_tokens'],
  { revalidate: 60, tags: ['theme_tokens', 'homepage'] },
);
