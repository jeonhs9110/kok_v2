import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getProducts, type Product } from '@/lib/api/products';
import { getActiveSlides, type CarouselSlide } from '@/lib/api/carousel';
import { withTimeout } from '@/lib/async-utils';
import type { PromoBanner } from '@/components/PromoBannersSection';
import type { SubHeroBannerData } from '@/components/SubHeroBanner';
import type { InstagramData, InstagramPost } from '@/components/InstagramSection';

const REVALIDATE = 60;
const QUERY_BUDGET_MS = 3000;
const TAGS = ['homepage'];

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

/**
 * Poisoned-cache prevention pattern (audit 2026-06-22).
 *
 * Each fetcher below is split in two:
 *   1. an INNER unstable_cache wrapper that lets errors / timeouts
 *      propagate (does not catch). When the inner throws, Next.js
 *      does NOT persist the result, so the next request retries.
 *   2. an OUTER export that catches the propagation and returns a
 *      safe fallback to the page. The page renders normally;
 *      transient failures don't crash the whole storefront.
 *
 * Before this pattern, every fetcher caught its own error and returned
 * the fallback INSIDE the cache wrapper — and Next.js happily cached
 * the empty fallback for the full 60s revalidate window. Storefront
 * customers landing during that window saw "상품이 없습니다" until the
 * TTL expired. The boss-flagged "first time loads empty, refresh works"
 * bug.
 */
function logFail(label: string, err: unknown): void {
  console.error(`[cache:${label}] failed:`, err);
}

// ─── products ─────────────────────────────────────────────────────
const cachedProductsInner = unstable_cache(
  async (): Promise<Product[]> => withTimeout(getProducts(), QUERY_BUDGET_MS),
  ['homepage:products'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'products'] },
);
export async function getCachedProducts(): Promise<Product[]> {
  try { return await cachedProductsInner(); }
  catch (err) { logFail('products', err); return []; }
}

// ─── carousel slides ──────────────────────────────────────────────
const cachedSlidesInner = unstable_cache(
  async (): Promise<CarouselSlide[]> => withTimeout(getActiveSlides(), QUERY_BUDGET_MS),
  ['homepage:slides'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'carousel'] },
);
export async function getCachedSlides(): Promise<CarouselSlide[]> {
  try { return await cachedSlidesInner(); }
  catch (err) { logFail('slides', err); return []; }
}

// ─── promo banners ────────────────────────────────────────────────
const cachedPromoBannersInner = unstable_cache(
  async (): Promise<PromoBanner[]> => {
    const c = client();
    if (!c) return [];
    const { data, error } = await withTimeout(
      c.from('promo_banners').select('id, image_url, link_url, sort_order')
        .eq('is_active', true).order('sort_order').limit(2),
      QUERY_BUDGET_MS,
    );
    if (error) throw error;
    return (data ?? []).map(r => ({
      id: r.id,
      image_url: r.image_url ?? '',
      link_url: r.link_url ?? '',
      sort_order: r.sort_order ?? 0,
    }));
  },
  ['homepage:promo'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'promo_banners'] },
);
export async function getCachedPromoBanners(): Promise<PromoBanner[]> {
  try { return await cachedPromoBannersInner(); }
  catch (err) { logFail('promo', err); return []; }
}

// ─── sub-hero ─────────────────────────────────────────────────────
const cachedSubHeroInner = unstable_cache(
  async (): Promise<SubHeroBannerData | null> => {
    const c = client();
    if (!c) return null;
    const { data, error } = await withTimeout(
      c.from('sub_hero_banners')
        .select(`
          id, image_url, link_url, title, subtitle,
          title_size_offset, subtitle_size_offset,
          title_font_family, subtitle_font_family,
          title_bold, title_italic, title_underline,
          subtitle_bold, subtitle_italic, subtitle_underline,
          title_color, subtitle_color, text_position, text_position_mobile
        `)
        .eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      QUERY_BUDGET_MS,
    );
    if (error) throw error;
    if (!data) return null;
    return {
      id: data.id,
      image_url: data.image_url ?? '',
      link_url: data.link_url ?? '',
      title: data.title ?? '',
      subtitle: data.subtitle ?? '',
      title_size_offset: data.title_size_offset,
      subtitle_size_offset: data.subtitle_size_offset,
      title_font_family: data.title_font_family,
      subtitle_font_family: data.subtitle_font_family,
      title_bold: data.title_bold,
      title_italic: data.title_italic,
      title_underline: data.title_underline,
      subtitle_bold: data.subtitle_bold,
      subtitle_italic: data.subtitle_italic,
      subtitle_underline: data.subtitle_underline,
      title_color: data.title_color,
      subtitle_color: data.subtitle_color,
      text_position: data.text_position,
      text_position_mobile: data.text_position_mobile,
    };
  },
  ['homepage:subhero'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'sub_hero'] },
);
export async function getCachedSubHero(): Promise<SubHeroBannerData | null> {
  try { return await cachedSubHeroInner(); }
  catch (err) { logFail('subhero', err); return null; }
}

// ─── instagram ────────────────────────────────────────────────────
const cachedInstagramInner = unstable_cache(
  async (): Promise<InstagramData | null> => {
    const c = client();
    if (!c) return null;
    const [configRes, postsRes] = await withTimeout(
      Promise.all([
        c.from('instagram_config')
          .select('handle, description, bg_type, bg_color, bg_media_url, bg_media_type, header_font_size, header_text_color, header_bg_color')
          .maybeSingle(),
        c.from('instagram_posts').select('id, image_url, link_url, post_url, sort_order').eq('is_active', true).order('sort_order').limit(6),
      ]),
      QUERY_BUDGET_MS,
    );
    // Per-query errors logged but don't throw — config might exist
    // without posts, or posts without a freshly-saved config row.
    if (configRes.error) console.error('[cache:instagram_config]', configRes.error);
    if (postsRes.error) console.error('[cache:instagram_posts]', postsRes.error);
    if (!configRes.data) return null;
    const posts: InstagramPost[] = (postsRes.data ?? []).map(p => ({
      id: p.id,
      image_url: p.image_url ?? '',
      link_url: p.link_url ?? '',
      post_url: p.post_url ?? undefined,
      sort_order: p.sort_order ?? 0,
    }));
    if (!configRes.data.handle) return null;
    return {
      handle: configRes.data.handle,
      description: configRes.data.description ?? '',
      posts,
      bg_type: configRes.data.bg_type ?? null,
      bg_color: configRes.data.bg_color ?? null,
      bg_media_url: configRes.data.bg_media_url ?? null,
      bg_media_type: configRes.data.bg_media_type ?? null,
      header_font_size: configRes.data.header_font_size ?? null,
      header_text_color: configRes.data.header_text_color ?? null,
      header_bg_color: configRes.data.header_bg_color ?? null,
    };
  },
  ['homepage:instagram'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'instagram'] },
);
export async function getCachedInstagram(): Promise<InstagramData | null> {
  try { return await cachedInstagramInner(); }
  catch (err) { logFail('instagram', err); return null; }
}

// ─── shorts bg config ─────────────────────────────────────────────
export interface ShortsBgConfig {
  bg_type: string | null;
  bg_color: string | null;
  bg_media_url: string | null;
  bg_media_type: string | null;
  /** Migration 33 — admin-editable title text + style. NULL falls
   *  through to the pre-2026-06-10 hardcoded "BRAND SHORTS" / white /
   *  15px / no plate look. */
  header_text: string | null;
  header_font_size: string | null;
  header_text_color: string | null;
  header_bg_color: string | null;
}

const cachedShortsBgInner = unstable_cache(
  async (): Promise<ShortsBgConfig | null> => {
    const c = client();
    if (!c) return null;
    const { data, error } = await withTimeout(
      c.from('shorts_config')
        .select('bg_type, bg_color, bg_media_url, bg_media_type, header_text, header_font_size, header_text_color, header_bg_color')
        .limit(1).maybeSingle(),
      QUERY_BUDGET_MS,
    );
    if (error) throw error;
    if (!data) return null;
    return {
      bg_type: data.bg_type ?? null,
      bg_color: data.bg_color ?? null,
      bg_media_url: data.bg_media_url ?? null,
      bg_media_type: data.bg_media_type ?? null,
      header_text: data.header_text ?? null,
      header_font_size: data.header_font_size ?? null,
      header_text_color: data.header_text_color ?? null,
      header_bg_color: data.header_bg_color ?? null,
    };
  },
  ['homepage:shorts_bg'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'shorts'] },
);
export async function getCachedShortsBg(): Promise<ShortsBgConfig | null> {
  try { return await cachedShortsBgInner(); }
  catch (err) { logFail('shorts_bg', err); return null; }
}

// ─── shorts list ──────────────────────────────────────────────────
export interface RawShort {
  youtube_id: string;
  product_id: string | null;
}

const cachedShortsInner = unstable_cache(
  async (): Promise<RawShort[]> => {
    const c = client();
    if (!c) return [];
    const { data, error } = await withTimeout(
      c.from('shorts').select('youtube_id, product_id').order('created_at', { ascending: false }).limit(10),
      QUERY_BUDGET_MS,
    );
    if (error) throw error;
    return data ?? [];
  },
  ['homepage:shorts'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'shorts'] },
);
export async function getCachedShorts(): Promise<RawShort[]> {
  try { return await cachedShortsInner(); }
  catch (err) { logFail('shorts', err); return []; }
}

// ─── review cards ─────────────────────────────────────────────────
// Reviews — homepage section added 2026-06-19 (Phase C of the Cafe24
// admin cleanup). The /menus/review page still calls getActiveReviewCards
// directly; this wrapper exists so the homepage SSR path gets cached +
// tag-evicted alongside the other section fetchers.
export interface RawReviewCard {
  id: string;
  image_url: string;
  title: string;
  link_url: string | null;
  sort_order: number;
}

const cachedReviewsInner = unstable_cache(
  async (): Promise<RawReviewCard[]> => {
    const c = client();
    if (!c) return [];
    const { data, error } = await withTimeout(
      c.from('review_cards')
        .select('id, image_url, title, link_url, sort_order')
        .eq('is_active', true)
        .order('sort_order', { ascending: true })
        .limit(8),
      QUERY_BUDGET_MS,
    );
    if (error) throw error;
    return (data ?? []).map(r => ({
      id: r.id,
      image_url: r.image_url ?? '',
      title: r.title ?? '',
      link_url: r.link_url ?? null,
      sort_order: r.sort_order ?? 0,
    }));
  },
  ['homepage:reviews'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'reviews'] },
);
export async function getCachedReviews(): Promise<RawReviewCard[]> {
  try { return await cachedReviewsInner(); }
  catch (err) { logFail('reviews', err); return []; }
}
