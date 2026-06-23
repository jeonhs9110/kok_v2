import Link from 'next/link';
import { TrendingUp } from 'lucide-react';
import ProductGrid, { type GridProduct } from '@/components/ProductGrid';
import { getTopViewedProducts } from '@/lib/api/topViewedProducts';
import type { Lang } from '@/lib/i18n/types';

/**
 * "지금 가장 많이 본 상품" — auto-populated social-proof rail on the
 * storefront homepage. Pulls the top-viewed products from analytics
 * over the last 7 days (cached 5 min) and renders them through the
 * same ProductGrid the BEST SELLER section uses, so the visual
 * language stays consistent.
 *
 * Renders NOTHING when there are < 3 products with views — early-life
 * empty state would just say "데이터가 부족합니다" to the customer,
 * which reads worse than the section quietly hiding itself.
 */

const LABEL: Record<Lang, string> = {
  kr: '지금 가장 많이 본 상품',
  en: 'TRENDING NOW',
};

const SUBTITLE: Record<Lang, string> = {
  kr: '최근 7일 인기',
  en: 'Last 7 days',
};

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
  const products = await getTopViewedProducts();
  if (products.length < 3) return null;

  const items: GridProduct[] = products.slice(0, 8).map(p => ({
    id: p.id,
    name: p.name,
    summary: p.summary,
    price: p.price,
    originalPrice: p.originalPrice,
    discountRate: calculateDiscount(p.price, p.originalPrice),
    imageUrl: p.imageUrl,
  }));

  return (
    <section
      className="kokkok-home-products relative"
      data-builder-section="top-viewed"
    >
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-16 md:pt-24 flex flex-col items-center text-center">
        <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-brand-accent uppercase mb-2">
          <TrendingUp className="w-3.5 h-3.5" />
          {SUBTITLE[lang]}
        </div>
        <h2 className="kokkok-product-section-title font-extrabold text-brand-ink">
          {LABEL[lang]}
        </h2>
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
