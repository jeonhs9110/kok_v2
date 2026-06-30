import { Suspense } from 'react';
import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';

import HeroSlider from '@/components/HeroSlider';
import ProductGrid, { type GridProduct } from '@/components/ProductGrid';
import PromoBannersSection from '@/components/PromoBannersSection';
import ShortsFeedSection, { ShortsFeedSkeleton } from '@/components/sections/ShortsFeedSection';
import TopViewedSection from '@/components/sections/TopViewedSection';
import SubHeroSection, { SubHeroSkeleton } from '@/components/sections/SubHeroSection';
import InstagramFeedSection, { InstagramFeedSkeleton } from '@/components/sections/InstagramFeedSection';
import ReviewsSection, { ReviewsSkeleton } from '@/components/sections/ReviewsSection';
import SectionErrorBoundary from '@/components/SectionErrorBoundary';

import HomepageBanner from '@/components/HomepageBanner';

import { getCachedProducts, getCachedSlides, getCachedPromoBanners } from '@/lib/cache/homepage';
import { getSectionOrder, isBannerKey } from '@/lib/api/sectionOrder';
import { getHomepageBanners } from '@/lib/api/homepageBanners';
import { getBestSellerDisplay } from '@/lib/api/bestSellerDisplay';
import { isValidLang, type Lang } from '@/lib/i18n/types';
import type { Product } from '@/lib/api/products';

// Global "you can't buy from here" notice was previously rendered here
// at the top of the page body, but the carousel's .kokkok-hero-overlay
// class pulls the hero UP under the header — a banner rendered between
// global-banner and carousel inside <main> got swept up along with the
// hero and disappeared behind it. The notice now lives in
// [lang]/layout.tsx, ABOVE the sticky header, so the hero's negative
// margin can't reach it.

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
  const title = isKr ? '콕콕가든 — 제주 카멜리아 PDRN 스킨케어' : 'Kokkok Garden — Jeju Camellia PDRN Skincare';
  const description = isKr
    ? '제주 동백 PDRN 성분의 K-뷰티 스킨케어. 1회 사용으로 완성하는 보습 케어.'
    : 'Korean skincare powered by Jeju Camellia PDRN. One-step deep hydration.';
  const url = `https://www.kokkokgarden.com/${lang}`;
  // OG image fallback chain (Kakao / Facebook crawlers walk it from the
  // top and use the first URL that returns 200):
  //   1. /og-default.png — 1200×630 raster card. Ships when the design
  //                        team delivers (operator request 2026-06-30).
  //                        Kakao + Facebook both prefer raster.
  //   2. /kokkokgarden_primary.svg — existing wordmark; keeps shares
  //                                  working today while the PNG is
  //                                  in design. Some Kakao client
  //                                  versions skip SVG entirely.
  //
  // Drop-in is literally: copy og-default.png into /public/ and
  // redeploy. No code change needed — the order below makes the PNG
  // authoritative as soon as it exists.
  const ogImages = [
    { url: 'https://www.kokkokgarden.com/og-default.png', alt: isKr ? '콕콕가든' : 'Kokkok Garden' },
    { url: 'https://www.kokkokgarden.com/kokkokgarden_primary.svg', alt: isKr ? '콕콕가든' : 'Kokkok Garden' },
  ];
  return {
    title,
    description,
    alternates: {
      canonical: `/${lang}`,
      languages: { 'ko-KR': '/kr', 'en-US': '/en' },
    },
    openGraph: {
      title: isKr ? '콕콕가든' : 'Kokkok Garden',
      description,
      url,
      type: 'website',
      locale: isKr ? 'ko_KR' : 'en_US',
      siteName: 'KOKKOK GARDEN',
      images: ogImages,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: ogImages.map(i => i.url),
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

  const [allProducts, carouselSlides, promoBanners, sectionOrder, homepageBanners, bestSellerDisplay] = await Promise.all([
    getCachedProducts(),
    getCachedSlides(),
    getCachedPromoBanners(),
    getSectionOrder(),
    getHomepageBanners(),
    getBestSellerDisplay(),
  ]);
  const bannersById = new Map(homepageBanners.map(b => [b.id, b]));

  const activeProducts = allProducts.filter(p => p.is_active);
  const bestSellerProducts = pickBestSellers(activeProducts);

  // ANUA-style hero overlay (PR #147) pulls the carousel UP under the
  // transparent header. That only makes sense when the carousel is the
  // FIRST section — if the operator drags an inline banner above it,
  // applying the negative margin makes the carousel overlap and hide
  // the banner. Guard the overlay on carouselIndex === 0.
  const isCarouselFirst = sectionOrder.indexOf('carousel') === 0;

  // Sections are rendered in the operator-controlled order pulled from
  // site_settings.homepage_section_order. Keys not in the saved row
  // fall back to the DEFAULT_ORDER tail (see lib/api/sectionOrder.ts)
  // so a newly-added section never disappears even if the operator
  // saved their order before the section existed.
  const sectionsMap: Record<string, React.ReactNode> = {
    'carousel': isCarouselFirst ? (
      <div className="kokkok-hero-overlay" data-builder-section="carousel">
        <HeroSlider lang={lang} slides={carouselSlides} />
      </div>
    ) : (
      <div data-builder-section="carousel">
        <HeroSlider lang={lang} slides={carouselSlides} />
      </div>
    ),
    'promo-banners': (
      <div data-builder-section="promo-banners">
        <PromoBannersSection banners={promoBanners} />
      </div>
    ),
    'products': (
      <section className="kokkok-home-products relative" data-builder-section="products">
        <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-16 md:pt-24 flex flex-col items-center text-center">
          <h2 className="kokkok-product-section-title font-extrabold text-brand-ink">{BEST_SELLER_LABEL[lang]}</h2>
          <Link
            href={`/${lang}/products`}
            className="mt-2 text-[13px] font-semibold text-neutral-500 hover:text-black tracking-wide transition-colors underline underline-offset-4"
          >
            View All
          </Link>
        </div>
        <ProductGrid products={bestSellerProducts} canPurchase={isKorea} displayConfig={bestSellerDisplay} lang={lang} />
      </section>
    ),
    'top-viewed': (
      <SectionErrorBoundary label="TopViewed">
        <Suspense fallback={null}>
          <TopViewedSection lang={lang} canPurchase={isKorea} />
        </Suspense>
      </SectionErrorBoundary>
    ),
    'shorts': (
      <SectionErrorBoundary label="ShortsFeed">
        <Suspense fallback={<ShortsFeedSkeleton />}>
          <div data-builder-section="shorts">
            <ShortsFeedSection lang={lang} />
          </div>
        </Suspense>
      </SectionErrorBoundary>
    ),
    'sub-hero': (
      <SectionErrorBoundary label="SubHero">
        <Suspense fallback={<SubHeroSkeleton />}>
          <div data-builder-section="sub-hero">
            <SubHeroSection />
          </div>
        </Suspense>
      </SectionErrorBoundary>
    ),
    'instagram': (
      <SectionErrorBoundary label="InstagramFeed">
        <Suspense fallback={<InstagramFeedSkeleton />}>
          <div data-builder-section="instagram">
            <InstagramFeedSection />
          </div>
        </Suspense>
      </SectionErrorBoundary>
    ),
    'reviews': (
      <SectionErrorBoundary label="Reviews">
        <Suspense fallback={<ReviewsSkeleton />}>
          <ReviewsSection lang={lang} />
        </Suspense>
      </SectionErrorBoundary>
    ),
  };

  // Organization + WebSite JSON-LD for Naver Knowledge Panel + Google
  // Search rich card. Operator-controlled name/address comes through
  // business_info, but at this scale we hardcode the brand identity
  // — switching it would mean rebranding the entire site anyway.
  const orgLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': 'https://www.kokkokgarden.com#org',
        name: 'KOKKOK GARDEN',
        alternateName: ['콕콕가든', '꼭꼭가든'],
        url: 'https://www.kokkokgarden.com',
        logo: 'https://www.kokkokgarden.com/kokkokgarden_primary.svg',
        sameAs: [
          'https://www.instagram.com/kokkokgarden_kr',
          'https://smartstore.naver.com/kokkok-garden',
        ],
      },
      {
        '@type': 'WebSite',
        '@id': 'https://www.kokkokgarden.com#website',
        url: 'https://www.kokkokgarden.com',
        name: 'KOKKOK GARDEN',
        inLanguage: lang === 'en' ? 'en-US' : 'ko-KR',
        publisher: { '@id': 'https://www.kokkokgarden.com#org' },
      },
    ],
  };

  return (
    <>
      {/* sr-only h1 — homepage previously had no h1, breaking the WCAG
          2.4.6 heading hierarchy. Visible page chrome stays the same; a
          screen reader gets a real page heading. */}
      <h1 className="sr-only">
        {lang === 'en' ? 'Kokkok Garden — Premium Korean Skincare' : '콕콕가든 — K-뷰티 스킨케어'}
      </h1>
      <script
        type="application/ld+json"
        // Plain JSON-LD; the value is constructed server-side from a
        // hardcoded shape, no operator input flows into it, so no XSS
        // risk from the embedded JSON.
        dangerouslySetInnerHTML={{ __html: JSON.stringify(orgLd) }}
      />
      {sectionOrder.map(key => {
        if (isBannerKey(key)) {
          const id = key.slice('banner:'.length);
          const banner = bannersById.get(id);
          if (!banner) return null;
          return (
            <div key={key} data-builder-section={key}>
              <HomepageBanner banner={banner} lang={lang} />
            </div>
          );
        }
        return <div key={key}>{sectionsMap[key]}</div>;
      })}
    </>
  );
}
