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

async function tryQuery<T>(p: PromiseLike<T>, label: string, fallback: T): Promise<T> {
  try {
    return await withTimeout(p, QUERY_BUDGET_MS);
  } catch (err) {
    console.error(`[cache:${label}] failed:`, err);
    return fallback;
  }
}

export const getCachedProducts = unstable_cache(
  () => tryQuery<Product[]>(getProducts(), 'products', []),
  ['homepage:products'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'products'] }
);

export const getCachedSlides = unstable_cache(
  () => tryQuery<CarouselSlide[]>(getActiveSlides(), 'slides', []),
  ['homepage:slides'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'carousel'] }
);

export const getCachedPromoBanners = unstable_cache(
  async (): Promise<PromoBanner[]> => {
    const c = client();
    if (!c) return [];
    try {
      const { data, error } = await withTimeout(
        c.from('promo_banners').select('id, image_url, link_url, sort_order')
          .eq('is_active', true).order('sort_order').limit(2),
        QUERY_BUDGET_MS
      );
      if (error) throw error;
      return (data ?? []).map(r => ({
        id: r.id,
        image_url: r.image_url ?? '',
        link_url: r.link_url ?? '',
        sort_order: r.sort_order ?? 0,
      }));
    } catch (err) {
      console.error('[cache:promo] failed:', err);
      return [];
    }
  },
  ['homepage:promo'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'promo_banners'] }
);

export const getCachedSubHero = unstable_cache(
  async (): Promise<SubHeroBannerData | null> => {
    const c = client();
    if (!c) return null;
    try {
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
        QUERY_BUDGET_MS
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
    } catch (err) {
      console.error('[cache:subhero] failed:', err);
      return null;
    }
  },
  ['homepage:subhero'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'sub_hero'] }
);

export const getCachedInstagram = unstable_cache(
  async (): Promise<InstagramData | null> => {
    const c = client();
    if (!c) return null;
    try {
      const [configRes, postsRes] = await withTimeout(
        Promise.all([
          c.from('instagram_config')
            .select('handle, description, bg_type, bg_color, bg_media_url, bg_media_type, header_font_size, header_text_color, header_bg_color')
            .maybeSingle(),
          c.from('instagram_posts').select('id, image_url, link_url, post_url, sort_order').eq('is_active', true).order('sort_order').limit(6),
        ]),
        QUERY_BUDGET_MS
      );
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
      // Drop section entirely if no handle is configured — previously
      // defaulted to 'rdrd_official' which is the wrong/old account and
      // hid the missing-config state.
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
    } catch (err) {
      console.error('[cache:instagram] failed:', err);
      return null;
    }
  },
  ['homepage:instagram'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'instagram'] }
);

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

export const getCachedShortsBg = unstable_cache(
  async (): Promise<ShortsBgConfig | null> => {
    const c = client();
    if (!c) return null;
    try {
      const { data, error } = await withTimeout(
        c.from('shorts_config')
          .select('bg_type, bg_color, bg_media_url, bg_media_type, header_text, header_font_size, header_text_color, header_bg_color')
          .limit(1).maybeSingle(),
        QUERY_BUDGET_MS
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
    } catch (err) {
      console.error('[cache:shorts_bg] failed:', err);
      return null;
    }
  },
  ['homepage:shorts_bg'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'shorts'] }
);

export interface RawShort {
  youtube_id: string;
  product_id: string | null;
}

export const getCachedShorts = unstable_cache(
  async (): Promise<RawShort[]> => {
    const c = client();
    if (!c) return [];
    try {
      const { data, error } = await withTimeout(
        c.from('shorts').select('youtube_id, product_id').order('created_at', { ascending: false }).limit(10),
        QUERY_BUDGET_MS
      );
      if (error) throw error;
      return data ?? [];
    } catch (err) {
      console.error('[cache:shorts] failed:', err);
      return [];
    }
  },
  ['homepage:shorts'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'shorts'] }
);
