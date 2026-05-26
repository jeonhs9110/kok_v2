import { headers } from 'next/headers';
import { unstable_cache } from 'next/cache';
import Link from 'next/link';

import HeroSlider from '@/components/HeroSlider';
import ProductGrid from '@/components/ProductGrid';
import ShortsFeed, { type ShortItem } from '@/components/ShortsFeed';
import PromoBannersSection, { type PromoBanner } from '@/components/PromoBannersSection';
import SubHeroBanner, { type SubHeroBannerData } from '@/components/SubHeroBanner';
import InstagramSection, { type InstagramData } from '@/components/InstagramSection';
import ReviewShowcase from '@/components/ReviewShowcase';
import { createClient } from '@supabase/supabase-js';
import { getProducts } from '@/lib/api/products';
import { getActiveSlides } from '@/lib/api/carousel';
import { getActiveReviewCards } from '@/lib/api/reviews';
import type { Lang } from '@/lib/i18n/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const FALLBACK_YT_IDS = ['ho0EhuO3RNs', 'lD1VId0ec2s', 'mkBTUDxMKtU', 'yPRcriD4FcM'];

const GLOBAL_BANNER: Record<string, string> = {
  kr: '글로벌 스토어입니다 — 주문은 한국 스토어를 이용해주세요',
  en: 'Global store — Products are available for purchase in South Korea only',
};

const BEST_SELLER_LABEL: Record<string, string> = {
  kr: 'BEST SELLER',
  en: 'BEST SELLER',
};

interface HomepageSideData {
  promoBanners: PromoBanner[];
  subHeroBanner: SubHeroBannerData | null;
  instagramData: InstagramData | null;
  liveShortsRaw: Array<{ youtube_id: string; product_id: string | null }>;
}

// All non-translated, country-agnostic homepage data folded into one parallel
// batch and cached server-side for 60s. The page itself still renders
// per-request (headers() is dynamic for country/lang), but the heavy Supabase
// fan-out happens at most once per minute regardless of traffic.
const getHomepageSideData = unstable_cache(
  async (): Promise<HomepageSideData> => {
    if (!supabase) {
      return { promoBanners: [], subHeroBanner: null, instagramData: null, liveShortsRaw: [] };
    }
    const [promoRes, subHeroRes, instaConfigRes, instaPostsRes, shortsRes] = await Promise.all([
      supabase.from('promo_banners').select('*').eq('is_active', true).order('sort_order').limit(2),
      supabase.from('sub_hero_banners').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
      supabase.from('instagram_config').select('*').maybeSingle(),
      supabase.from('instagram_posts').select('*').eq('is_active', true).order('sort_order').limit(6),
      supabase.from('shorts').select('youtube_id, product_id').order('created_at', { ascending: false }).limit(10),
    ]);

    if (promoRes.error) console.error('promo_banners load failed:', promoRes.error);
    if (subHeroRes.error) console.error('sub_hero_banners load failed:', subHeroRes.error);
    if (instaConfigRes.error) console.error('instagram_config load failed:', instaConfigRes.error);
    if (instaPostsRes.error) console.error('instagram_posts load failed:', instaPostsRes.error);
    if (shortsRes.error) console.error('shorts load failed:', shortsRes.error);

    return {
      promoBanners: (promoRes.data ?? []) as PromoBanner[],
      subHeroBanner: (subHeroRes.data ?? null) as SubHeroBannerData | null,
      instagramData: instaConfigRes.data
        ? {
            handle: instaConfigRes.data.handle || 'rdrd_official',
            description: instaConfigRes.data.description || '',
            posts: instaPostsRes.data || [],
          }
        : null,
      liveShortsRaw: shortsRes.data ?? [],
    };
  },
  ['homepage-side-data'],
  { revalidate: 60, tags: ['homepage'] }
);

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || headersList.get('x-user-country') || 'KR';
  const isKorea = country === 'KR';

  const banner = GLOBAL_BANNER[lang] ?? GLOBAL_BANNER['en'];

  const calculateDiscount = (price: number, original: number) =>
    original > price ? Math.round(((original - price) / original) * 100) : 0;

  const [allProducts, carouselSlides, reviewCards, sideData] = await Promise.all([
    getProducts(),
    getActiveSlides(),
    getActiveReviewCards(),
    getHomepageSideData(),
  ]);

  const activeProducts = allProducts.filter(p => p.is_active);

  const toGridItem = (p: typeof activeProducts[number]) => ({
    id: p.id,
    name: p.name,
    summary: p.summary,
    price: p.price,
    originalPrice: p.originalPrice,
    discountRate: calculateDiscount(p.price, p.originalPrice),
    imageUrl: p.imageUrl,
  });

  let bestSellerProducts = activeProducts.filter(p => p.is_best_seller).slice(0, 3).map(toGridItem);
  if (bestSellerProducts.length === 0) {
    bestSellerProducts = activeProducts.slice(0, 3).map(toGridItem);
  }

  const finalShorts: ShortItem[] = sideData.liveShortsRaw.length > 0
    ? sideData.liveShortsRaw.map(d => ({
        embedUrl: `https://www.youtube.com/embed/${d.youtube_id}`,
        productUrl: d.product_id ? `/${lang}/products/${d.product_id}` : undefined,
      }))
    : FALLBACK_YT_IDS.map(id => ({ embedUrl: `https://www.youtube.com/embed/${id}` }));

  return (
    <div className="animate-in fade-in duration-700">
      {!isKorea && (
        <div className="bg-gradient-to-r from-[#4a7ab5] to-[#6b9fd4] text-white text-center py-2 px-4 text-[13px] font-medium">
          🌏 {banner}
        </div>
      )}

      <HeroSlider lang={lang as Lang} slides={carouselSlides} />

      <PromoBannersSection banners={sideData.promoBanners} />

      <div className="relative">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-16 md:pt-24 flex flex-col items-center text-center">
          <h2 className="text-2xl font-extrabold text-[#111]">
            {BEST_SELLER_LABEL[lang] ?? 'BEST SELLER'}
          </h2>
          <Link
            href={`/${lang}/products`}
            className="mt-2 text-[13px] font-semibold text-neutral-500 hover:text-black tracking-wide transition-colors underline underline-offset-4"
          >
            View All
          </Link>
        </div>
        <ProductGrid products={bestSellerProducts} canPurchase={isKorea} />
      </div>

      <ShortsFeed shorts={finalShorts} />

      <SubHeroBanner banner={sideData.subHeroBanner} />

      <ReviewShowcase cards={reviewCards} lang={lang} title={lang === 'kr' ? 'REVIEW & COMMUNITY' : 'REVIEWS'} />

      <InstagramSection data={sideData.instagramData} />
    </div>
  );
}
