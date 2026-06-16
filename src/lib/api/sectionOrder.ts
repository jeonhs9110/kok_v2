import { cache } from 'react';
import { supabase } from '@/lib/api/products';

/**
 * Section keys recognized on the homepage. Adding a new section: 1) add
 * it to this union, 2) add a render branch in [lang]/page.tsx's
 * sectionsMap, 3) update DEFAULT_ORDER below if it should appear by
 * default in fresh installs. Any key in the saved order that isn't in
 * this union is silently dropped; any section in DEFAULT_ORDER that
 * isn't in the saved order falls through at the END so a newly-added
 * section never disappears even if the operator's saved order is stale.
 */
export type CoreSectionKey =
  | 'carousel'
  | 'promo-banners'
  | 'products'
  | 'shorts'
  | 'sub-hero'
  | 'instagram';

/**
 * Banner keys are `banner:<uuid>` — operator-spawned inline strips that
 * live anywhere in the homepage flow. See lib/api/homepageBanners and
 * components/HomepageBanner.
 */
export type BannerSectionKey = `banner:${string}`;

export type HomepageSectionKey = CoreSectionKey | BannerSectionKey;

export const DEFAULT_ORDER: CoreSectionKey[] = [
  'carousel',
  'promo-banners',
  'products',
  'shorts',
  'sub-hero',
  'instagram',
];

const VALID_CORE = new Set<CoreSectionKey>(DEFAULT_ORDER);

export function isBannerKey(key: string): key is BannerSectionKey {
  return key.startsWith('banner:') && key.length > 7;
}

function parse(raw: unknown): HomepageSectionKey[] {
  let arr: unknown = raw;
  if (typeof raw === 'string') {
    try { arr = JSON.parse(raw); } catch { return [...DEFAULT_ORDER]; }
  }
  if (!Array.isArray(arr)) return [...DEFAULT_ORDER];
  const seenCore = new Set<CoreSectionKey>();
  const seenBanners = new Set<string>();
  const result: HomepageSectionKey[] = [];
  for (const k of arr) {
    if (typeof k !== 'string') continue;
    if (isBannerKey(k)) {
      if (seenBanners.has(k)) continue;
      seenBanners.add(k);
      result.push(k);
      continue;
    }
    if (!VALID_CORE.has(k as CoreSectionKey)) continue;
    if (seenCore.has(k as CoreSectionKey)) continue;
    seenCore.add(k as CoreSectionKey);
    result.push(k as CoreSectionKey);
  }
  // Backfill any default-order section missing from the saved row
  // so a newly-added section appears at the end instead of being lost.
  for (const k of DEFAULT_ORDER) {
    if (!seenCore.has(k)) result.push(k);
  }
  return result;
}

export const getSectionOrder = cache(async (): Promise<HomepageSectionKey[]> => {
  if (!supabase) return DEFAULT_ORDER;
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'homepage_section_order')
      .maybeSingle();
    if (error || !data) return DEFAULT_ORDER;
    return parse(data.value);
  } catch {
    return DEFAULT_ORDER;
  }
});
