import { headers } from 'next/headers';
import Link from 'next/link';
import HeroSlider from '@/components/HeroSlider';
import ProductGrid from '@/components/ProductGrid';
import ShortsFeed, { type ShortItem } from '@/components/ShortsFeed';
import PromoBannersSection, { type PromoBanner } from '@/components/PromoBannersSection';
import SubHeroBanner, { type SubHeroBannerData } from '@/components/SubHeroBanner';
import InstagramSection, { type InstagramData } from '@/components/InstagramSection';
import { createClient } from '@supabase/supabase-js';
import { getProducts } from '@/lib/api/products';
import { getActiveSlides } from '@/lib/api/carousel';
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

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || headersList.get('x-user-country') || 'KR';
  const isKorea = country === 'KR';

  const banner = GLOBAL_BANNER[lang] ?? GLOBAL_BANNER['en'];

  const calculateDiscount = (price: number, original: number) =>
    original > price ? Math.round(((original - price) / original) * 100) : 0;

  // Fetch all data in parallel
  const [allProducts, carouselSlides] = await Promise.all([getProducts(), getActiveSlides()]);
  const activeProducts = allProducts.filter(p => p.is_active);

  const formattedProducts = activeProducts.map(p => ({
    id: p.id,
    name: p.name,
    summary: p.summary,
    price: p.price,
    originalPrice: p.originalPrice,
    discountRate: calculateDiscount(p.price, p.originalPrice),
    imageUrl: p.imageUrl,
  }));

  // Best Seller: products with is_best_seller=true, max 3
  let bestSellerProducts = activeProducts
    .filter(p => p.is_best_seller)
    .slice(0, 3)
    .map(p => ({
      id: p.id,
      name: p.name,
      summary: p.summary,
      price: p.price,
      originalPrice: p.originalPrice,
      discountRate: calculateDiscount(p.price, p.originalPrice),
      imageUrl: p.imageUrl,
    }));

  // Fallback: if no best sellers marked, use first 3 active products
  if (bestSellerProducts.length === 0) {
    bestSellerProducts = formattedProducts.slice(0, 3);
  }

  // Promo banners (2x1:1 clickable)
  let promoBanners: PromoBanner[] = [];
  try {
    if (supabase) {
      const { data } = await supabase
        .from('promo_banners')
        .select('*')
        .eq('is_active', true)
        .order('sort_order')
        .limit(2);
      if (data && data.length > 0) promoBanners = data;
    }
  } catch { /* skip */ }

  // Sub hero banner
  let subHeroBanner: SubHeroBannerData | null = null;
  try {
    if (supabase) {
      const { data } = await supabase
        .from('sub_hero_banners')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (data) subHeroBanner = data;
    }
  } catch { /* skip */ }

  // Instagram config + posts
  let instagramData: InstagramData | null = null;
  try {
    if (supabase) {
      const [configRes, postsRes] = await Promise.all([
        supabase.from('instagram_config').select('*').single(),
        supabase.from('instagram_posts').select('*').eq('is_active', true).order('sort_order').limit(6),
      ]);
      if (configRes.data) {
        instagramData = {
          handle: configRes.data.handle || 'rdrd_official',
          description: configRes.data.description || '',
          posts: postsRes.data || [],
        };
      }
    }
  } catch { /* use defaults */ }

  // Shorts with product links
  let liveShorts: ShortItem[] = [];
  try {
    if (supabase) {
      const { data, error } = await supabase
        .from('shorts')
        .select('youtube_id, product_id')
        .order('created_at', { ascending: false })
        .limit(10);
      if (!error && data && data.length > 0) {
        liveShorts = data.map(d => ({
          embedUrl: `https://www.youtube.com/embed/${d.youtube_id}`,
          productUrl: d.product_id ? `/${lang}/products/${d.product_id}` : undefined,
        }));
      }
    }
  } catch { /* use fallback */ }

  const finalShorts: ShortItem[] = liveShorts.length > 0
    ? liveShorts
    : FALLBACK_YT_IDS.map(id => ({ embedUrl: `https://www.youtube.com/embed/${id}` }));

  return (
    <div className="animate-in fade-in duration-700">
      {/* Global store notice */}
      {!isKorea && (
        <div className="bg-gradient-to-r from-[#4a7ab5] to-[#6b9fd4] text-white text-center py-2 px-4 text-[13px] font-medium">
          🌏 {banner}
        </div>
      )}

      {/* 1. Main Hero Banner (3~4 slides) */}
      <HeroSlider lang={lang as Lang} slides={carouselSlides} />

      {/* 2. 1:1 Promo Banners (2EA, clickable links) */}
      <PromoBannersSection banners={promoBanners} />

      {/* 3. Best Seller — 3 products + View All */}
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

      {/* 4. Video Review — YouTube Shorts + saved videos, click → product page */}
      <ShortsFeed shorts={finalShorts} />

      {/* 5. Sub Hero Banner */}
      <SubHeroBanner banner={subHeroBanner} />

      {/* 6. Instagram feed */}
      <InstagramSection data={instagramData} />
    </div>
  );
}
