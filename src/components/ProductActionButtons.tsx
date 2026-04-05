'use client';
import { useState } from 'react';
import { useI18n } from '@/lib/i18n/context';
import { useCart } from '@/lib/cart/CartContext';

interface ProductActionButtonsProps {
  productId: string;
  productName: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  naverStoreUrl?: string;
}

export default function ProductActionButtons({ productId, productName, price, originalPrice, imageUrl, naverStoreUrl }: ProductActionButtonsProps) {
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const { t } = useI18n();
  const { addItem } = useCart();

  const increase = () => setQuantity(prev => prev + 1);
  const decrease = () => setQuantity(prev => (prev > 1 ? prev - 1 : 1));

  const handleAddToCart = () => {
    addItem({ productId, name: productName, price, originalPrice, imageUrl }, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    addItem({ productId, name: productName, price, originalPrice, imageUrl }, quantity);
    window.location.href = '/cart';
  };

  return (
    <div className="space-y-6 pt-8 mt-8 border-t border-neutral-100">
      {/* Quantity Selector */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-800 tracking-wider">수량</span>
        <div className="flex items-center border border-neutral-200">
          <button onClick={decrease} className="px-4 py-2.5 text-lg text-neutral-400 hover:bg-neutral-50 hover:text-black transition-colors" disabled={quantity <= 1}>−</button>
          <span className="w-12 text-center text-sm font-semibold">{quantity}</span>
          <button onClick={increase} className="px-4 py-2.5 text-lg text-neutral-400 hover:bg-neutral-50 hover:text-black transition-colors">+</button>
        </div>
      </div>

      {/* Total Price preview */}
      <div className="flex justify-between items-end pb-4 pt-2">
         <span className="text-sm font-semibold text-neutral-500">총 상품금액</span>
         <span className="text-2xl font-extrabold text-[#111111]">{(price * quantity).toLocaleString()}원</span>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-2">
        <button
          onClick={handleAddToCart}
          className={`flex-1 border py-4.5 font-bold tracking-widest text-[13px] transition-colors ${
            added ? 'bg-green-600 border-green-600 text-white' : 'bg-white border-[#111111] text-[#111111] hover:bg-neutral-50'
          }`}
        >
          {added ? '✓ 담았습니다' : t('product.addToCart')}
        </button>
        <button
          onClick={handleBuyNow}
          className="flex-1 bg-[#111111] text-white py-4.5 font-bold tracking-widest text-[13px] hover:bg-black transition-colors shadow-lg shadow-black/10"
        >
          {t('product.buyNow')}
        </button>
      </div>

      {/* Naver Store button */}
      {naverStoreUrl && (
        <a
          href={naverStoreUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 w-full py-3.5 bg-[#03C75A] text-white font-bold text-[13px] tracking-wider hover:bg-[#02b351] transition-colors"
        >
          네이버 스토어에서 구매 ↗
        </a>
      )}
    </div>
  );
}
