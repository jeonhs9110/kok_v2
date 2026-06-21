import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { EMPTY_COUNTS, type SectionCounts, type HomepageBanner } from './useHomepageSections';

const supabase = getSupabaseBrowser();

const DEFAULT_SECTION_ORDER = [
  'carousel', 'promo-banners', 'products', 'shorts', 'sub-hero', 'instagram',
];

/**
 * Three-channel loader for /admin/homepage: the saved drag-order, the inline
 * banner rows, and the per-section count snapshot for the card sub-labels.
 *
 * Each channel runs independently — a hiccup loading one doesn't block the
 * others. Errors degrade to defaults so the operator never sees a blank hub
 * because one of seven count queries failed. Returns the state + setters
 * the parent needs for drag-reorder + add-banner mutations.
 */
export function useHomepageData() {
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_ORDER);
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [counts, setCounts] = useState<SectionCounts>(EMPTY_COUNTS);
  // Initial isLoading derives from supabase availability so we never sync
  // setState inside the count-fetch effect below (react-hooks/set-state-in-effect).
  const [isLoading, setIsLoading] = useState(supabase !== null);

  // Saved section order — falls back to DEFAULT_SECTION_ORDER on missing row
  // or unparseable value so a fresh DB doesn't render an empty hub.
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'homepage_section_order')
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (Array.isArray(parsed) && parsed.every(k => typeof k === 'string')) {
            setSectionOrder(parsed);
          }
        } catch { /* keep default */ }
      }
    })().catch(err => console.error('[admin/homepage] section order load failed:', err));
  }, []);

  // Inline banners. Mutations elsewhere update local state optimistically,
  // so a re-fetch isn't necessary here.
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from('homepage_banners')
        .select('id,text,bg_color,text_color,is_active');
      if (data) setBanners(data as HomepageBanner[]);
    })().catch(err => console.error('[admin/homepage] banners load failed:', err));
  }, []);

  // Per-section count snapshot. 13 parallel queries; any single hiccup
  // degrades to 0 instead of crashing the hub.
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const [
        carouselAll, carouselActive,
        promoAll, promoActive,
        productsAll, productsActive,
        shorts,
        subHeroAll, subHeroActive,
        igConfig, igPosts,
        reviewsAll, reviewsActive,
      ] = await Promise.all([
        supabase.from('carousel_slides').select('id', { count: 'exact', head: true }),
        supabase.from('carousel_slides').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('promo_banners').select('id', { count: 'exact', head: true }),
        supabase.from('promo_banners').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('shorts').select('id', { count: 'exact', head: true }),
        supabase.from('sub_hero_banners').select('id', { count: 'exact', head: true }),
        supabase.from('sub_hero_banners').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('instagram_config').select('handle').maybeSingle(),
        supabase.from('instagram_posts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('review_cards').select('id', { count: 'exact', head: true }),
        supabase.from('review_cards').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      setCounts({
        carouselTotal:      carouselAll.count ?? 0,
        carouselActive:     carouselActive.count ?? 0,
        promoBannersTotal:  promoAll.count ?? 0,
        promoBannersActive: promoActive.count ?? 0,
        productsTotal:      productsAll.count ?? 0,
        productsActive:     productsActive.count ?? 0,
        shortsTotal:        shorts.count ?? 0,
        subHeroTotal:       subHeroAll.count ?? 0,
        subHeroActive:      subHeroActive.count ?? 0,
        instagramHandle:    (igConfig.data as { handle: string } | null)?.handle ?? null,
        instagramPosts:     igPosts.count ?? 0,
        reviewsTotal:       reviewsAll.count ?? 0,
        reviewsActive:      reviewsActive.count ?? 0,
      });
      setIsLoading(false);
    })().catch(err => {
      console.error('[admin/homepage] count fetch failed:', err);
      setIsLoading(false);
    });
  }, []);

  return {
    sectionOrder,
    setSectionOrder,
    banners,
    setBanners,
    counts,
    isLoading,
  };
}
