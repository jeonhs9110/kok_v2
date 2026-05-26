'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ShoppingBag, Heart } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { useState } from 'react';
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
}

export default function ProductCard({ id, name, summary, price, originalPrice, discountRate, imageUrl, canPurchase = true }: ProductCardProps) {
  const { t, lang } = useI18n();
  const { addItem } = useCart();
  const wishlistCtx = useOptionalWishlist();
  const router = useRouter();
  const wishlisted = wishlistCtx?.isWishlisted(id) ?? false;
  const [cartAdded, setCartAdded] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({ productId: id, name, price, originalPrice, imageUrl });
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 1500);
  };

  const toggleWish = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!wishlistCtx) return;
    const result = await wishlistCtx.toggle(id);
    if (result === null) {
      router.push('/login');
    }
  };

  return (
    <div className="group block">
      <Link href={`/${lang}/products/${id}`} className="block">
        <div className="relative aspect-[5/6] w-full rounded-[16px] overflow-hidden bg-[#F5F5F5] mb-4">
          <img
            src={imageUrl}
            alt={name}
            width={500}
            height={600}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out"
            loading="lazy"
          />
          <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={toggleWish}
              aria-label={wishlisted ? (lang === 'kr' ? '위시리스트에서 제거' : 'Remove from wishlist') : (lang === 'kr' ? '위시리스트에 추가' : 'Add to wishlist')}
              aria-pressed={wishlisted}
              className={`w-9 h-9 rounded-full backdrop-blur-sm shadow-md flex items-center justify-center transition-colors ${
                wishlisted ? 'bg-red-500 text-white' : 'bg-white/90 text-neutral-600 hover:bg-red-50 hover:text-red-500'
              }`}
            >
              <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} aria-hidden="true" />
            </button>
            {canPurchase && (
              <button
                onClick={handleAddToCart}
                aria-label={lang === 'kr' ? '장바구니에 담기' : 'Add to cart'}
                className={`w-9 h-9 rounded-full backdrop-blur-sm shadow-md flex items-center justify-center transition-colors ${
                  cartAdded ? 'bg-green-500 text-white' : 'bg-white/90 text-neutral-600 hover:bg-black hover:text-white'
                }`}
              >
                {cartAdded ? <span className="text-xs font-bold" aria-hidden="true">✓</span> : <ShoppingBag className="w-4 h-4" aria-hidden="true" />}
              </button>
            )}
          </div>
        </div>
        <div className="flex flex-col space-y-1 px-1">
          <h3 className="text-[13px] font-bold text-[#333] leading-tight break-keep">{name}</h3>
          <p className="text-[12px] text-[#999] leading-tight line-clamp-1">{summary}</p>

          <div className="flex items-center space-x-1.5 mt-2">
            {discountRate > 0 && (
              <span className="text-[15px] font-extrabold text-[#f15a24]">{discountRate}%</span>
            )}
            <span className="text-[15px] font-extrabold text-[#111]">
              {lang === 'kr' ? `${price.toLocaleString()}원` : `KRW ${price.toLocaleString()}`}
            </span>
          </div>

          {originalPrice > price && (
            <span className="text-[13px] text-[#b5b5b5] line-through block mt-0.5">
              {lang === 'kr' ? `${originalPrice.toLocaleString()}원` : `KRW ${originalPrice.toLocaleString()}`}
            </span>
          )}

          {!canPurchase && (
            <span className="text-[11px] text-[#6b9fd4] font-medium mt-1 flex items-center gap-1">
              🌏 {t('product.unavailable')}
            </span>
          )}
        </div>
      </Link>
    </div>
  );
}
