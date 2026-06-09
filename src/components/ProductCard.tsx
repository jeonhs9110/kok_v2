'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Heart } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/lib/cart/CartContext';
import { useOptionalWishlist } from '@/lib/wishlist/WishlistContext';

interface ProductCardProps {
  id: string;
  name: string;
  summary: string;
  price: number;
  originalPrice: number;
  discountRate: number;
  imageUrl: string;
  canPurchase?: boolean;
  /**
   * Optional ingredient-tag chips shown above the product name. Each
   * entry is the localised label already resolved by the parent (so
   * ProductCard doesn't need its own ingredient_tags fetch). Allergens
   * get an amber chip; everything else gets a neutral pill — matches
   * the product detail page treatment.
   */
  tags?: { label: string; isAllergen?: boolean }[];
}

export default function ProductCard({ id, name, summary, price, originalPrice, discountRate, imageUrl, canPurchase = true, tags = [] }: ProductCardProps) {
  const { t, lang } = useI18n();
  const { addItem } = useCart();
  const wishlistCtx = useOptionalWishlist();
  const router = useRouter();
  const wishlisted = wishlistCtx?.isWishlisted(id) ?? false;
  const [cartAdded, setCartAdded] = useState(false);
  const [wishPending, setWishPending] = useState(false);
  const cartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (cartTimeoutRef.current) clearTimeout(cartTimeoutRef.current);
    };
  }, []);

  const handleAddToCart = () => {
    // Guard double-click — cartAdded state is set sync, so the next click
    // within 1500ms sees the toast still up and bails. Prevents the slow-3G
    // pattern of users spamming the button while waiting for feedback.
    if (cartAdded) return;
    addItem({ productId: id, name, price, originalPrice, imageUrl });
    setCartAdded(true);
    if (cartTimeoutRef.current) clearTimeout(cartTimeoutRef.current);
    cartTimeoutRef.current = setTimeout(() => setCartAdded(false), 1500);
  };

  const toggleWish = async () => {
    if (!wishlistCtx || wishPending) return;
    setWishPending(true);
    try {
      const result = await wishlistCtx.toggle(id);
      if (result === null && !wishlistCtx.loading) {
        router.push('/login');
      }
    } finally {
      setWishPending(false);
    }
  };

  const priceText = lang === 'kr' ? `${price.toLocaleString()}원` : `KRW ${price.toLocaleString()}`;
  const originalPriceText = lang === 'kr' ? `${originalPrice.toLocaleString()}원` : `KRW ${originalPrice.toLocaleString()}`;
  const wishLabel = wishlisted
    ? (lang === 'kr' ? '위시리스트에서 제거' : 'Remove from wishlist')
    : (lang === 'kr' ? '위시리스트에 추가' : 'Add to wishlist');
  const cartLabel = lang === 'kr' ? '장바구니에 담기' : 'Add to cart';

  return (
    <article className="group relative">
      <div className="relative aspect-[5/6] w-full rounded-[16px] overflow-hidden bg-neutral-100 mb-4">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
            className="object-cover group-hover:scale-105 transition-transform duration-500 ease-out"
          />
        ) : (
          <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-300 text-[10px] font-bold tracking-widest">
            NO IMAGE
          </div>
        )}
        <div className="absolute bottom-3 right-3 z-10 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
          <button
            type="button"
            onClick={toggleWish}
            disabled={wishPending}
            aria-label={wishLabel}
            aria-pressed={wishlisted}
            aria-busy={wishPending}
            className={`w-11 h-11 rounded-full backdrop-blur-sm shadow-md flex items-center justify-center transition-colors disabled:opacity-60 disabled:cursor-wait ${
              wishlisted ? 'bg-red-500 text-white' : 'bg-white/90 text-neutral-600 hover:bg-red-50 hover:text-red-500'
            }`}
          >
            <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} aria-hidden="true" />
          </button>
          {canPurchase && (
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={cartAdded}
              aria-label={cartLabel}
              className={`w-11 h-11 rounded-full backdrop-blur-sm shadow-md flex items-center justify-center transition-colors disabled:cursor-default ${
                cartAdded ? 'bg-green-500 text-white' : 'bg-white/90 text-neutral-600 hover:bg-black hover:text-white'
              }`}
            >
              {cartAdded ? <span className="text-xs font-bold" aria-hidden="true">✓</span> : <ShoppingBag className="w-4 h-4" aria-hidden="true" />}
            </button>
          )}
          {/* SR-only live region so color-blind / screen-reader users get
              the wishlist state change in addition to the color/fill cue. */}
          <span className="sr-only" aria-live="polite">
            {wishlisted ? wishLabel : ''}
          </span>
        </div>
      </div>

      <div className="flex flex-col space-y-1 px-1">
        {/* Ingredient pills — first 3 only so the card height stays
            consistent. Allergen tags get amber so they're spottable at
            a glance even outside the PDP. */}
        {tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {tags.slice(0, 3).map((t, i) => (
              <span
                key={i}
                className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                  t.isAllergen
                    ? 'bg-amber-50 text-amber-700 border border-amber-200'
                    : 'bg-neutral-100 text-neutral-600'
                }`}
              >
                {t.label}
              </span>
            ))}
            {tags.length > 3 && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-500">
                +{tags.length - 3}
              </span>
            )}
          </div>
        )}
        <h3 className="kokkok-product-name font-bold text-neutral-800 leading-tight break-keep">{name}</h3>
        <p className="text-[12px] text-neutral-500 leading-tight line-clamp-1">{summary}</p>

        <div className="flex items-center space-x-1.5 mt-2">
          {discountRate > 0 && (
            <span className="kokkok-price font-extrabold text-brand-accent">{discountRate}%</span>
          )}
          <span className="kokkok-price font-extrabold text-brand-ink">{priceText}</span>
        </div>

        {originalPrice > price && (
          /* Striked original price stays at a fixed smaller size so the
             active price reads as the primary value; not wired to the
             product_price_size token on purpose. */
          <span className="text-[13px] text-neutral-500 line-through block mt-0.5">{originalPriceText}</span>
        )}

        {!canPurchase && (
          <span className="text-[11px] text-brand-notice-to font-medium mt-1 flex items-center gap-1">
            🌏 {t('product.unavailable')}
          </span>
        )}
      </div>

      {/* Stretched link — covers entire card via ::before, sits BELOW the
          z-10 action buttons so clicks on the wish/cart icons aren't
          intercepted. Avoids the WCAG violation of nesting <button>
          inside <a>. */}
      <Link
        href={`/${lang}/products/${id}`}
        aria-label={name}
        className="absolute inset-0 z-0 rounded-[16px] before:absolute before:inset-0 before:content-[''] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand-ink"
      />
    </article>
  );
}
