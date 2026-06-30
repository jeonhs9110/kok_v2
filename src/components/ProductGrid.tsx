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
  /**
   * Locale for the empty-state copy. Empty state previously hard-coded
   * Korean ("상품이 없습니다.") even when the rest of the page rendered
   * in English. Optional with a safe 'kr' default so existing callers
   * don't break.
   */
  lang?: 'kr' | 'en';
}

const BASE_MAX_WIDTH_PX = 1240;

/**
 * Derive the desktop column count from the operator's scale slider.
 * The previous implementation kept 4 cols at every scale and grew the
 * container max-width past the viewport. The viewport always capped the
 * grid in practice, so a 2.5× setting only nudged cards from ~290 → 340px
 * (~17% bigger, not 2.5×). The fix: at higher scales, drop columns so the
 * card percentage of viewport actually grows.
 *
 *   ≤1.2  → 4 columns (pre-PR look at scale 1.0)
 *   1.2–1.8 → 3 columns
 *   >1.8  → 2 columns (each card ~50% of viewport — what the operator asked for)
 */
function desktopColumnsForScale(scale: number): number {
  if (scale > 1.8) return 2;
  if (scale > 1.2) return 3;
  return 4;
}

export default function ProductGrid({
  title,
  products,
  canPurchase = true,
  displayConfig = DEFAULT_BEST_SELLER_DISPLAY,
  lang = 'kr',
}: ProductGridProps) {
  // Container max-width still scales with card_scale so brands that
  // want a wider band on ultra-wide monitors get one. Cards stay a %
  // of that container; the desktop column count drops at high scales
  // so the visible size actually matches operator expectations on a
  // typical 1440px viewport.
  const containerMaxWidth = `${BASE_MAX_WIDTH_PX * displayConfig.card_scale}px`;
  const cols = desktopColumnsForScale(displayConfig.card_scale);
  const lgPct = 100 / cols;
  const lgGapPerCard = (displayConfig.gap_x * (cols - 1)) / cols;
  const lgWidth = `calc(${lgPct}% - ${lgGapPerCard}px)`;
  const smWidth = `calc(50% - ${displayConfig.gap_x / 2}px)`;
  return (
    <section className="py-16 md:py-24">
      <div className="mx-auto px-4 sm:px-6" style={{ maxWidth: containerMaxWidth }}>
        {title && (
          <h2 className="text-2xl font-extrabold text-center mb-12 text-brand-ink">{title}</h2>
        )}
        {products.length === 0 ? (
          // Empty state — previously the grid rendered to a zero-height
          // div, which on /products with all-inactive products read as a
          // broken page. A short message keeps the chrome and signals
          // "intentional, not failed."
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="text-sm text-neutral-500 mb-1">
              {lang === 'en' ? 'No products available.' : '상품이 없습니다.'}
            </p>
            <p className="text-xs text-neutral-400">
              {lang === 'en'
                ? "We'll be back with something new soon."
                : '곧 새로운 상품으로 찾아뵙겠습니다.'}
            </p>
          </div>
        ) : (
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
        )}
      </div>
    </section>
  );
}
