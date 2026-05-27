import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_RETAILERS,
  LABEL_KEYS,
  resolveLabels,
  type RetailerEntry,
  type Region,
  type WorldwideLabels,
} from './defaults';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const IS_DEV = process.env.NODE_ENV === 'development';

interface LabelRow {
  label_key: string;
  kr: string | null;
  en: string | null;
  cn: string | null;
  jp: string | null;
  vn: string | null;
  th: string | null;
}

interface RetailerRow {
  id: number;
  country_code: string;
  country_native: string;
  country_en: string;
  region: string;
  store_name: string | null;
  store_url: string | null;
  store_logo_url: string | null;
  country_image_url: string | null;
  banner_color: string | null;
  is_active: boolean;
  sort_order: number;
}

export interface WorldwidePageData {
  labels: WorldwideLabels;
  retailers: RetailerEntry[];
}

/**
 * Server-side fetch for the /worldwide page.
 * Resolves the 20+ UI labels for the current language (falls back to English
 * per-key, then to the hardcoded defaults) and the active retailer list.
 */
// Fallback policy:
//   - DEV / preview:  fall back to DEFAULT_RETAILERS (28 hardcoded countries
//     with '#' placeholders) so local development without a populated DB
//     still shows a worldwide page.
//   - PRODUCTION:    return ONLY what the DB has. Empty DB -> empty page.
//     No more 28 "coming soon" placeholders pretending to be live retailer
//     coverage. If the operator hasn't seeded worldwide_retailers, the page
//     is honestly empty rather than misleading customers about reach.
// Retailers with a missing/'#' store_url are filtered out (we won't ship a
// broken link). Banner color falls back to black as a pure cosmetic default.
export async function fetchWorldwideData(lang: string): Promise<WorldwidePageData> {
  const labelsOnly = (): WorldwidePageData => ({
    labels: resolveLabels(lang),
    retailers: IS_DEV ? DEFAULT_RETAILERS : [],
  });

  if (!supabase) {
    console.error('[worldwide] Supabase client not configured');
    return labelsOnly();
  }

  try {
    const [labelsRes, retailersRes] = await Promise.all([
      supabase.from('worldwide_labels').select('*'),
      supabase.from('worldwide_retailers').select('*').eq('is_active', true).order('sort_order'),
    ]);

    const defaults = resolveLabels(lang);
    const labels: WorldwideLabels = { ...defaults };

    if (labelsRes.data) {
      const rows = labelsRes.data as LabelRow[];
      const byKey = new Map(rows.map(r => [r.label_key, r]));
      for (const key of LABEL_KEYS) {
        const row = byKey.get(key);
        if (!row) continue;
        const value = (row as unknown as Record<string, string | null>)[lang]
          ?? row.en
          ?? defaults[key];
        if (value) labels[key] = value;
      }
    }

    let retailers: RetailerEntry[];
    if (retailersRes.data && retailersRes.data.length > 0) {
      const rows = retailersRes.data as RetailerRow[];
      retailers = rows
        // Drop rows without a real store URL — a "#" link is worse than no
        // tile at all because it advertises coverage we don't have.
        .filter(r => r.store_url && r.store_url.trim() !== '' && r.store_url.trim() !== '#')
        .map(r => ({
          id: String(r.id),
          countryCode: r.country_code,
          country: r.country_native,
          countryEn: r.country_en,
          region: (r.region as Region) ?? 'ASIA',
          storeName: r.store_name ?? '',
          storeUrl: r.store_url as string,
          storeLogoUrl: r.store_logo_url ?? '',
          countryImageUrl: r.country_image_url ?? '',
          bannerColor: r.banner_color ?? '#111111',
        }));
    } else {
      retailers = IS_DEV ? DEFAULT_RETAILERS : [];
    }

    return { labels, retailers };
  } catch (err) {
    console.error('[worldwide] Supabase fetch failed:', err);
    return labelsOnly();
  }
}
