import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_RETAILERS,
  LABEL_KEYS,
  resolveLabels,
  type RetailerEntry,
  type Region,
  type WorldwideLabels,
} from './defaults';

// 2026-06-29: dispatched via USE_RDS. Pre-fix this helper hit Supabase
// unconditionally, so the storefront /worldwide page has been showing
// the empty-state (or stale 2026-06-27 retailers) for every visitor
// since the cutover. Same pattern as /[lang]/contact + /[lang]/pages
// caught earlier — admin's worldwide edits land in RDS but the public
// page was reading from the dead Supabase silo.
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
function buildPageData(
  lang: string,
  labelsRows: LabelRow[],
  retailersRows: RetailerRow[],
): WorldwidePageData {
  const defaults = resolveLabels(lang);
  const labels: WorldwideLabels = { ...defaults };
  const byKey = new Map(labelsRows.map(r => [r.label_key, r]));
  for (const key of LABEL_KEYS) {
    const row = byKey.get(key);
    if (!row) continue;
    const value = (row as unknown as Record<string, string | null>)[lang]
      ?? row.en
      ?? defaults[key];
    if (value) labels[key] = value;
  }
  // Drop rows without a real store URL — a "#" link is worse than no
  // tile at all because it advertises coverage we don't have.
  const retailers: RetailerEntry[] = retailersRows.length > 0
    ? retailersRows
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
        }))
    : (IS_DEV ? DEFAULT_RETAILERS : []);
  return { labels, retailers };
}

export async function fetchWorldwideData(lang: string): Promise<WorldwidePageData> {
  const labelsOnly = (): WorldwidePageData => ({
    labels: resolveLabels(lang),
    retailers: IS_DEV ? DEFAULT_RETAILERS : [],
  });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const [labelsRes, retailersRes] = await Promise.all([
        pool.query<LabelRow>(
          `SELECT label_key, kr, en, cn, jp, vn, th FROM public.worldwide_labels`,
        ),
        pool.query<RetailerRow>(
          `SELECT id, country_code, country_native, country_en, region,
                  store_name, store_url, store_logo_url, country_image_url,
                  banner_color, is_active, sort_order
             FROM public.worldwide_retailers
            WHERE is_active = true
            ORDER BY sort_order ASC`,
        ),
      ]);
      return buildPageData(lang, labelsRes.rows, retailersRes.rows);
    } catch (err) {
      console.error('[worldwide] RDS fetch failed:', err);
      return labelsOnly();
    }
  }

  if (!supabase) {
    console.error('[worldwide] Supabase client not configured');
    return labelsOnly();
  }

  try {
    const [labelsRes, retailersRes] = await Promise.all([
      supabase.from('worldwide_labels').select('*'),
      supabase.from('worldwide_retailers').select('*').eq('is_active', true).order('sort_order'),
    ]);
    return buildPageData(
      lang,
      (labelsRes.data ?? []) as LabelRow[],
      (retailersRes.data ?? []) as RetailerRow[],
    );
  } catch (err) {
    console.error('[worldwide] Supabase fetch failed:', err);
    return labelsOnly();
  }
}
