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

const BASE_MAX_WIDTH_PX = 1240;

export default function ProductGrid({
  title,
  products,
  canPurchase = true,
  displayConfig = DEFAULT_BEST_SELLER_DISPLAY,
}: ProductGridProps) {
  // card_scale grows/shrinks the section's container max-width rather
  // than each card's flex basis. This keeps the grid at 4-col desktop /
  // 2-col mobile (no overflow + wrap at scale>1.0) while the cards
  // themselves get proportionally bigger because they remain a fixed
  // percentage of a wider container. Previous implementation widened
  // the card flex basis directly — at scale=1.2 each card became 30%
  // wide × 4 cards = 120% and wrapped to 2 rows.
  const containerMaxWidth = `${BASE_MAX_WIDTH_PX * displayConfig.card_scale}px`;
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto px-4 sm:px-6" style={{ maxWidth: containerMaxWidth }}>
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
                ['--cardW-sm' as string]: `calc(50% - ${displayConfig.gap_x / 2}px)`,
                ['--cardW-lg' as string]: `calc(25% - ${(displayConfig.gap_x * 3) / 4}px)`,
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
