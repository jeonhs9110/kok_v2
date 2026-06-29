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
      <ProductGrid products={items} canPurchase={canPurchase} />
    </section>
  );
}
