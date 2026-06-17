import ProductCard from './ProductCard';
import type { BestSellerDisplay } from '@/lib/api/bestSellerDisplay';
import { DEFAULT_BEST_SELLER_DISPLAY } from '@/lib/api/bestSellerDisplay';

export interface GridProduct {
  id: string;
  name: string;
  summary: string;
  price: number;
  originalPrice: number;
  discountRate: number;
  imageUrl: string;
}

interface ProductGridProps {
  title?: string;
  products: GridProduct[];
  canPurchase?: boolean;
  /**
   * Operator-controlled scale + gap. Optional — falls back to the
   * pre-PR look so pages that don't pass it (e.g. /products listing)
   * render unchanged.
   */
  displayConfig?: BestSellerDisplay;
}

export default function ProductGrid({
  title,
  products,
  canPurchase = true,
  displayConfig = DEFAULT_BEST_SELLER_DISPLAY,
}: ProductGridProps) {
  // card_scale rescales both columns: at 1.0 the grid is 2-col mobile /
  // 4-col desktop (pre-PR look). 1.2 widens cards by 20% (still 4-col on
  // desktop but each card claims more of the row). 0.8 narrows them.
  const lgWidth = `calc(${25 * displayConfig.card_scale}% - ${displayConfig.gap_x * (1 - 1 / 4)}px)`;
  const smWidth = `calc(${50 * displayConfig.card_scale}% - ${displayConfig.gap_x / 2}px)`;
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        {title && (
          <h2 className="text-2xl font-extrabold text-center mb-12 text-brand-ink">{title}</h2>
        )}
        <div
          className="flex flex-wrap justify-center"
          style={{
            columnGap: `${displayConfig.gap_x}px`,
            rowGap: `${displayConfig.gap_y}px`,
          }}
        >
          {products.map((p) => (
            <div
              key={p.id}
              style={{
                ['--cardW-sm' as string]: smWidth,
                ['--cardW-lg' as string]: lgWidth,
              }}
              className="kokkok-product-card-cell"
            >
              <ProductCard {...p} canPurchase={canPurchase} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
