import { cache } from 'react';
import { supabase } from '@/lib/api/products';
import { DEFAULT_THEME_TOKENS, parseThemeTokens, type ThemeTokens } from './tokens';

/**
 * Server-side fetcher for the persisted theme tokens. Falls back to the
 * baked-in defaults if the row doesn't exist or the JSON is malformed,
 * so the storefront never breaks because of a bad admin input.
 *
 * Wrapped in React `cache()` so the [lang]/layout fetch is deduped within
 * one render. Not paired with the longer-lived process memo from
 * lib/cache/header.ts intentionally — theme edits should appear on the
 * very next request, not after a 60s TTL.
 */
export const getThemeTokens = cache(async (): Promise<ThemeTokens> => {
  if (!supabase) return DEFAULT_THEME_TOKENS;
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'theme_tokens')
      .maybeSingle();
    if (error || !data) return DEFAULT_THEME_TOKENS;
    return parseThemeTokens(data.value);
  } catch {
    return DEFAULT_THEME_TOKENS;
  }
});
