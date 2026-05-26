import { unstable_cache } from 'next/cache';
import { createClient } from '@supabase/supabase-js';
import { getProducts } from '@/lib/api/products';
import { getActiveSlides } from '@/lib/api/carousel';
import { getActiveReviewCards } from '@/lib/api/reviews';
import type { PromoBanner } from '@/components/PromoBannersSection';
import type { SubHeroBannerData } from '@/components/SubHeroBanner';
import type { InstagramData, InstagramPost } from '@/components/InstagramSection';

const REVALIDATE = 60;
const TAGS = ['homepage'];

function client() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  return url && key ? createClient(url, key) : null;
}

export const getCachedProducts = unstable_cache(
  () => getProducts(),
  ['homepage:products'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'products'] }
);

export const getCachedSlides = unstable_cache(
  () => getActiveSlides(),
  ['homepage:slides'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'carousel'] }
);

export const getCachedReviewCards = unstable_cache(
  () => getActiveReviewCards(),
  ['homepage:reviews'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'reviews'] }
);

export const getCachedPromoBanners = unstable_cache(
  async (): Promise<PromoBanner[]> => {
    const c = client();
    if (!c) return [];
    const { data, error } = await c
      .from('promo_banners')
      .select('id, image_url, link_url, sort_order')
      .eq('is_active', true)
      .order('sort_order')
      .limit(2);
    if (error) {
      console.error('promo_banners load failed:', error);
      return [];
    }
    return (data ?? []).map(r => ({
      id: r.id,
      image_url: r.image_url ?? '',
      link_url: r.link_url ?? '',
      sort_order: r.sort_order ?? 0,
    }));
  },
  ['homepage:promo'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'promo_banners'] }
);

export const getCachedSubHero = unstable_cache(
  async (): Promise<SubHeroBannerData | null> => {
    const c = client();
    if (!c) return null;
    const { data, error } = await c
      .from('sub_hero_banners')
      .select('id, image_url, link_url, title, subtitle')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      console.error('sub_hero_banners load failed:', error);
      return null;
    }
    if (!data) return null;
    return {
      id: data.id,
      image_url: data.image_url ?? '',
      link_url: data.link_url ?? '',
      title: data.title ?? '',
      subtitle: data.subtitle ?? '',
    };
  },
  ['homepage:subhero'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'sub_hero'] }
);

export const getCachedInstagram = unstable_cache(
  async (): Promise<InstagramData | null> => {
    const c = client();
    if (!c) return null;
    const [configRes, postsRes] = await Promise.all([
      c.from('instagram_config').select('handle, description').maybeSingle(),
      c.from('instagram_posts').select('id, image_url, link_url, post_url, sort_order').eq('is_active', true).order('sort_order').limit(6),
    ]);
    if (configRes.error) console.error('instagram_config load failed:', configRes.error);
    if (postsRes.error) console.error('instagram_posts load failed:', postsRes.error);
    if (!configRes.data) return null;
    const posts: InstagramPost[] = (postsRes.data ?? []).map(p => ({
      id: p.id,
      image_url: p.image_url ?? '',
      link_url: p.link_url ?? '',
      post_url: p.post_url ?? undefined,
      sort_order: p.sort_order ?? 0,
    }));
    return {
      handle: configRes.data.handle ?? 'rdrd_official',
      description: configRes.data.description ?? '',
      posts,
    };
  },
  ['homepage:instagram'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'instagram'] }
);

export interface RawShort {
  youtube_id: string;
  product_id: string | null;
}

export const getCachedShorts = unstable_cache(
  async (): Promise<RawShort[]> => {
    const c = client();
    if (!c) return [];
    const { data, error } = await c
      .from('shorts')
      .select('youtube_id, product_id')
      .order('created_at', { ascending: false })
      .limit(10);
    if (error) {
      console.error('shorts load failed:', error);
      return [];
    }
    return data ?? [];
  },
  ['homepage:shorts'],
  { revalidate: REVALIDATE, tags: [...TAGS, 'shorts'] }
);
