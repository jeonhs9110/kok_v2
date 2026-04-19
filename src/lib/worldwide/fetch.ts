import { createClient } from '@supabase/supabase-js';
import {
  DEFAULT_LABELS,
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
export async function fetchWorldwideData(lang: string): Promise<WorldwidePageData> {
  if (!supabase) {
    return { labels: resolveLabels(lang), retailers: DEFAULT_RETAILERS };
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

    let retailers: RetailerEntry[] = DEFAULT_RETAILERS;
    if (retailersRes.data && retailersRes.data.length > 0) {
      const rows = retailersRes.data as RetailerRow[];
      retailers = rows.map(r => ({
        id: r.country_code,
        country: r.country_native,
        countryEn: r.country_en,
        region: (r.region as Region) ?? 'ASIA',
        storeName: r.store_name ?? '',
        storeUrl: r.store_url ?? '#',
        bannerColor: r.banner_color ?? '#111111',
      }));
    }

    return { labels, retailers };
  } catch {
    return { labels: resolveLabels(lang), retailers: DEFAULT_RETAILERS };
  }
}
