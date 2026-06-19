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
 */
function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

export const getThemeTokens = unstable_cache(
  async (): Promise<ThemeTokens> => {
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
