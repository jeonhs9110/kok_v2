import Link from 'next/link';
import ProductGrid, { type GridProduct } from '@/components/ProductGrid';
import { getTopViewedProducts } from '@/lib/api/topViewedProducts';
import { getTopViewedConfig } from '@/lib/api/topViewedConfig';
import TopViewedHeader from './TopViewedHeader';
import type { Lang } from '@/lib/i18n/types';

/**
 * "지금 가장 많이 본 상품" — auto-populated social-proof rail on the
 * storefront homepage. Pulls top-viewed products from analytics over
 * the operator-configured window (defaults 7d / top 8) and renders
 * through the same ProductGrid the BEST SELLER section uses, so the
 * visual language stays consistent.
 *
 * Hidden when:
 *   - `is_active = false` in /admin/top-viewed
 *   - fewer than 3 products with views (early-life empty state would
 *     read worse than the section quietly hiding itself)
 *
 * Title + subtitle are operator-controlled per language; the live
 * preview overlay for those lives in <TopViewedHeader>.
 */

/**
 * Match the eventual rendered height (title + subtitle + product grid
 * row + View All link) so the section space is reserved during
 * suspense. Prior fallback was null which shipped a 0-height
 * placeholder — the section then jumped in and shoved everything
 * below it down, a CLS +0.1-0.3 hit that alone fails the CWV
 * threshold. Numbers are approximate — a few px of slack is fine
 * because ProductGrid rows are consistent between suspense + real
 * render.
 */
export function TopViewedSkeleton() {
  return (
    <section className="kokkok-home-products relative py-16 md:py-24">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 flex flex-col items-center text-center">
        <div className="h-8 w-64 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none mb-3" />
        <div className="h-4 w-40 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none mb-8" />
        <div className="h-4 w-20 bg-neutral-100 rounded animate-pulse motion-reduce:animate-none" />
      </div>
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 mt-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 sm:gap-6">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="aspect-[3/4] bg-neutral-100 rounded animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </section>
  );
}

function calculateDiscount(price: number, original: number): number {
  return original > price ? Math.round(((original - price) / original) * 100) : 0;
}

export default async function TopViewedSection({
  lang,
  canPurchase,
}: {
  lang: Lang;
  canPurchase: boolean;
}) {
  const config = await getTopViewedConfig();
  if (!config.is_active) return null;

  const products = await getTopViewedProducts({
    windowDays: config.window_days,
    topN: config.top_n,
  });
  if (products.length < 3) return null;

  const items: GridProduct[] = products.slice(0, config.top_n).map(p => ({
    id: p.id,
    name: p.name,
    summary: p.summary,
    price: p.price,
    originalPrice: p.originalPrice,
    discountRate: calculateDiscount(p.price, p.originalPrice),
    imageUrl: p.imageUrl,
  }));

  const initialTitle = lang === 'kr' ? config.title_kr : config.title_en;
  const initialSubtitle = lang === 'kr' ? config.subtitle_kr : config.subtitle_en;

  return (
    <section
      className="kokkok-home-products relative"
      data-builder-section="top-viewed"
    >
      <TopViewedHeader lang={lang} initialTitle={initialTitle} initialSubtitle={initialSubtitle} />
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 -mt-1 flex flex-col items-center text-center">
        <Link
          href={`/${lang}/products`}
          className="mt-2 text-[13px] font-semibold text-neutral-500 hover:text-black tracking-wide transition-colors underline underline-offset-4"
        >
          View All
        </Link>
      </div>
      <ProductGrid products={items} canPurchase={canPurchase} lang={lang} />
    </section>
  );
}
