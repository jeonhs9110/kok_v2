import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

import HeroSlider from '@/components/HeroSlider';
import ProductGrid, { type GridProduct } from '@/components/ProductGrid';
import PromoBannersSection from '@/components/PromoBannersSection';
import ShortsFeedSection, { ShortsFeedSkeleton } from '@/components/sections/ShortsFeedSection';
import SubHeroSection, { SubHeroSkeleton } from '@/components/sections/SubHeroSection';
import ReviewShowcaseSection, { ReviewShowcaseSkeleton } from '@/components/sections/ReviewShowcaseSection';
import InstagramFeedSection, { InstagramFeedSkeleton } from '@/components/sections/InstagramFeedSection';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

import { getCachedProducts, getCachedSlides, getCachedPromoBanners } from '@/lib/cache/homepage';
import { isValidLang, type Lang } from '@/lib/i18n/types';
import type { Product } from '@/lib/api/products';

const GLOBAL_BANNER: Record<Lang, string> = {
  kr: '글로벌 스토어입니다 — 주문은 한국 스토어를 이용해주세요',
  en: 'Global store — Products are available for purchase in South Korea only',
};

const BEST_SELLER_LABEL: Record<Lang, string> = {
  kr: 'BEST SELLER',
  en: 'BEST SELLER',
};

function calculateDiscount(price: number, original: number): number {
  return original > price ? Math.round(((original - price) / original) * 100) : 0;
}

function toGridItem(p: Product): GridProduct {
  return {
    id: p.id,
    name: p.name,
    summary: p.summary,
    price: p.price,
    originalPrice: p.originalPrice,
    discountRate: calculateDiscount(p.price, p.originalPrice),
    imageUrl: p.imageUrl,
  };
}

function pickBestSellers(products: Product[]): GridProduct[] {
  const flagged = products.filter(p => p.is_best_seller).slice(0, 3);
  const source = flagged.length > 0 ? flagged : products.slice(0, 3);
  return source.map(toGridItem);
}

export async function generateMetadata(
  { params }: { params: Promise<{ lang: string }> }
): Promise<Metadata> {
  const { lang } = await params;
  const isKr = lang === 'kr';
  return {
    title: isKr ? '콕콕가든 — 제주 카멜리아 PDRN 스킨케어' : 'Kokkok Garden — Jeju Camellia PDRN Skincare',
    description: isKr
      ? '제주 동백 PDRN 성분의 K-뷰티 스킨케어. 1회 사용으로 완성하는 보습 케어.'
      : 'Korean skincare powered by Jeju Camellia PDRN. One-step deep hydration.',
    alternates: {
      canonical: `/${lang}`,
      languages: { 'ko-KR': '/kr', 'en-US': '/en' },
    },
    openGraph: {
      title: isKr ? '콕콕가든' : 'Kokkok Garden',
      locale: isKr ? 'ko_KR' : 'en_US',
      type: 'website',
    },
  };
}

export default async function HomePage({ params }: { params: Promise<{ lang: string }> }) {
  const { lang: rawLang } = await params;
  if (!isValidLang(rawLang)) notFound();
  const lang: Lang = rawLang;

  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country')
    || headersList.get('cloudfront-viewer-country')
    || headersList.get('x-user-country')
    || 'KR';
  const isKorea = country === 'KR';

  const [allProducts, carouselSlides, promoBanners] = await Promise.all([
    getCachedProducts(),
    getCachedSlides(),
    getCachedPromoBanners(),
  ]);

  const activeProducts = allProducts.filter(p => p.is_active);
  const bestSellerProducts = pickBestSellers(activeProducts);

  return (
    <>
      {!isKorea && (
        <div className="bg-gradient-to-r from-brand-notice-from to-brand-notice-to text-white text-center py-2 px-4 text-[13px] font-medium">
          🌏 {GLOBAL_BANNER[lang]}
        </div>
      )}

      <HeroSlider lang={lang} slides={carouselSlides} />

      <PromoBannersSection banners={promoBanners} />

      <section className="relative">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-16 md:pt-24 flex flex-col items-center text-center">
          <h2 className="text-2xl font-extrabold text-brand-ink">{BEST_SELLER_LABEL[lang]}</h2>
          <Link
            href={`/${lang}/products`}
            className="mt-2 text-[13px] font-semibold text-neutral-500 hover:text-black tracking-wide transition-colors underline underline-offset-4"
          >
            View All
          </Link>
        </div>
        <ProductGrid products={bestSellerProducts} canPurchase={isKorea} />
      </section>

      <SectionErrorBoundary label="ShortsFeed">
        <Suspense fallback={<ShortsFeedSkeleton />}>
          <ShortsFeedSection lang={lang} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary label="SubHero">
        <Suspense fallback={<SubHeroSkeleton />}>
          <SubHeroSection />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary label="ReviewShowcase">
        <Suspense fallback={<ReviewShowcaseSkeleton />}>
          <ReviewShowcaseSection lang={lang} />
        </Suspense>
      </SectionErrorBoundary>

      <SectionErrorBoundary label="InstagramFeed">
        <Suspense fallback={<InstagramFeedSkeleton />}>
          <InstagramFeedSection />
        </Suspense>
      </SectionErrorBoundary>
    </>
  );
}
