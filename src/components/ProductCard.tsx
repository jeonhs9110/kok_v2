'use client';

import Link from 'next/link';
import { ShoppingBag, Heart } from 'lucide-react';
import { useI18n } from '@/lib/i18n/context';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useCart } from '@/lib/cart/CartContext';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
  const [wishlisted, setWishlisted] = useState(false);
  const [wishLoading, setWishLoading] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    addItem({ productId: id, name, price, originalPrice, imageUrl });
    setCartAdded(true);
    setTimeout(() => setCartAdded(false), 1500);
  };

  useEffect(() => {
    (async () => {
      if (!supabase) return;
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from('wishlist').select('id').eq('user_id', user.id).eq('product_id', id).maybeSingle();
      if (data) setWishlisted(true);
    })();
  }, [id]);

  const toggleWish = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!supabase) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = '/login';
      return;
    }

    setWishLoading(true);
    try {
      if (wishlisted) {
        await supabase.from('wishlist').delete().eq('user_id', user.id).eq('product_id', id);
        setWishlisted(false);
      } else {
        await supabase.from('wishlist').insert([{ user_id: user.id, product_id: id }]);
        setWishlisted(true);
      }
    } catch { /* ignore */ }
    setWishLoading(false);
  };

  return (
    <div className="group block">
      <Link href={`/${lang}/products/${id}`} className="block">
        <div className="relative aspect-[5/6] w-full rounded-[16px] overflow-hidden bg-[#F5F5F5] mb-4">
          <img
            src={imageUrl}
            alt={name}
            className="object-cover w-full h-full group-hover:scale-105 transition-transform duration-500 ease-out"
          />
          <div className="absolute bottom-3 right-3 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <button
              onClick={toggleWish}
              disabled={wishLoading}
              className={`w-9 h-9 rounded-full backdrop-blur-sm shadow-md flex items-center justify-center transition-colors ${
                wishlisted ? 'bg-red-500 text-white' : 'bg-white/90 text-neutral-600 hover:bg-red-50 hover:text-red-500'
              }`}
            >
              <Heart className={`w-4 h-4 ${wishlisted ? 'fill-current' : ''}`} />
            </button>
            {canPurchase && (
              <button
                onClick={handleAddToCart}
                className={`w-9 h-9 rounded-full backdrop-blur-sm shadow-md flex items-center justify-center transition-colors ${
                  cartAdded ? 'bg-green-500 text-white' : 'bg-white/90 text-neutral-600 hover:bg-black hover:text-white'
                }`}
              >
                {cartAdded ? <span className="text-xs font-bold">✓</span> : <ShoppingBag className="w-4 h-4" />}
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
            <span className="text-[15px] font-extrabold text-[#111]">{price.toLocaleString()}원</span>
          </div>

          {originalPrice > price && (
            <span className="text-[13px] text-[#b5b5b5] line-through block mt-0.5">
              {originalPrice.toLocaleString()}원
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
