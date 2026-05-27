'use client';

import Link from 'next/link';
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, X, ChevronRight } from 'lucide-react';
import { useCart } from '@/lib/cart/CartContext';
import { useI18n } from '@/lib/i18n/context';
import type { Lang } from '@/lib/i18n/types';

const LABELS: Record<Lang, {
  home: string; cart: string; empty: string; emptyHint: string; goShop: string;
  totalCount: (n: number) => string; clearAll: string; clearConfirm: string;
  productInfo: string; qty: string; amount: string; del: string;
  removeConfirm: (name: string) => string;
  summary: string; subtotal: string; discount: string; shipping: string;
  free: string; grandTotal: string; checkout: string; checkoutWip: string;
  continueShopping: string; currency: string;
}> = {
  kr: {
    home: 'HOME', cart: '장바구니', empty: '장바구니가 비어있습니다',
    emptyHint: '마음에 드는 상품을 담아보세요', goShop: '쇼핑하러 가기',
    totalCount: n => `총 ${n}개의 상품`, clearAll: '전체 삭제',
    clearConfirm: '장바구니를 비우시겠습니까?',
    productInfo: '상품 정보', qty: '수량', amount: '금액', del: '삭제',
    removeConfirm: name => `"${name}" 을(를) 삭제하시겠습니까?`,
    summary: '주문 요약', subtotal: '상품 금액', discount: '할인 금액',
    shipping: '배송비', free: '무료', grandTotal: '총 결제금액',
    checkout: '결제하기', checkoutWip: '결제 기능은 준비 중입니다.',
    continueShopping: '쇼핑 계속하기', currency: '원',
  },
  en: {
    home: 'HOME', cart: 'Cart', empty: 'Your cart is empty',
    emptyHint: 'Add items you love to your cart', goShop: 'Continue shopping',
    totalCount: n => `${n} item${n === 1 ? '' : 's'}`, clearAll: 'Clear all',
    clearConfirm: 'Clear your cart?',
    productInfo: 'Product', qty: 'Qty', amount: 'Total', del: 'Remove',
    removeConfirm: name => `Remove "${name}" from cart?`,
    summary: 'Order Summary', subtotal: 'Subtotal', discount: 'Discount',
    shipping: 'Shipping', free: 'Free', grandTotal: 'Total',
    checkout: 'Checkout', checkoutWip: 'Checkout coming soon.',
    continueShopping: 'Continue shopping', currency: 'KRW',
  },
};

function formatPrice(n: number, lang: Lang) {
  const lb = LABELS[lang];
  if (lang === 'kr') return `${n.toLocaleString()}${lb.currency}`;
  return `${lb.currency} ${n.toLocaleString()}`;
}

export default function CartContent() {
  const { lang } = useI18n();
  const lb = LABELS[lang];
  const { items, updateQuantity, removeItem, clearCart, totalPrice, totalCount } = useCart();
  const homeHref = `/${lang}`;
  const productsHref = `/${lang}/products`;
  const productHref = (id: string) => `/${lang}/products/${id}`;

  if (items.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
        <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
          <Link href={homeHref} className="hover:text-black transition-colors">{lb.home}</Link>
          <ChevronRight className="w-3 h-3 mx-2" />
          <span className="text-[#111]">{lb.cart}</span>
        </div>

        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-neutral-50 flex items-center justify-center mb-6">
            <ShoppingBag className="w-8 h-8 text-neutral-300" />
          </div>
          <h2 className="text-xl font-extrabold text-[#111] mb-2">{lb.empty}</h2>
          <p className="text-sm text-neutral-400 mb-8">{lb.emptyHint}</p>
          <Link
            href={productsHref}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#111] text-white text-[13px] font-bold tracking-wider hover:bg-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> {lb.goShop}
          </Link>
        </div>
      </div>
    );
  }

  const discountTotal = items.reduce((sum, i) => {
    const disc = i.originalPrice > i.price ? (i.originalPrice - i.price) * i.quantity : 0;
    return sum + disc;
  }, 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
        <Link href={homeHref} className="hover:text-black transition-colors">{lb.home}</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-[#111]">{lb.cart}</span>
      </div>

      <div className="flex items-end justify-between mb-8 pb-6 border-b-2 border-[#111]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111]">{lb.cart}</h1>
          <p className="text-xs text-neutral-400 mt-2">{lb.totalCount(totalCount)}</p>
        </div>
        <button
          onClick={() => { if (confirm(lb.clearConfirm)) clearCart(); }}
          className="text-[11px] text-neutral-400 hover:text-red-500 font-semibold tracking-wide transition-colors"
        >
          {lb.clearAll}
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14">
        <div className="flex-1">
          <div className="hidden sm:grid grid-cols-[1fr_120px_140px_60px] gap-4 pb-3 text-[11px] font-bold tracking-widest text-neutral-400 uppercase border-b border-neutral-100">
            <span>{lb.productInfo}</span>
            <span className="text-center">{lb.qty}</span>
            <span className="text-right">{lb.amount}</span>
            <span className="text-right">{lb.del}</span>
          </div>

          <div className="divide-y divide-neutral-100">
            {items.map(item => {
              const discount = item.originalPrice > item.price
                ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                : 0;

              return (
                <div key={item.productId} className="py-6 sm:grid sm:grid-cols-[1fr_120px_140px_60px] sm:gap-4 sm:items-center">
                  <div className="flex gap-4">
                    <Link href={productHref(item.productId)} className="flex-shrink-0">
                      <div className="w-[80px] h-[100px] sm:w-[90px] sm:h-[112px] rounded overflow-hidden bg-[#F5F5F5]">
                        {item.imageUrl ? (
                          /* eslint-disable-next-line @next/next/no-img-element */
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover mix-blend-multiply" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-neutral-300" />
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="flex flex-col justify-center min-w-0">
                      <Link href={productHref(item.productId)} className="hover:underline underline-offset-2">
                        <h3 className="text-[13px] font-bold text-[#111] leading-snug line-clamp-2">{item.name}</h3>
                      </Link>
                      <div className="flex items-center gap-2 mt-2">
                        {discount > 0 && (
                          <span className="text-[13px] font-extrabold text-[#f15a24]">{discount}%</span>
                        )}
                        <span className="text-[14px] font-extrabold text-[#111]">{formatPrice(item.price, lang)}</span>
                      </div>
                      {item.originalPrice > item.price && (
                        <span className="text-[12px] text-neutral-400 line-through mt-0.5">{formatPrice(item.originalPrice, lang)}</span>
                      )}
                    </div>
                  </div>

                  <div className="flex sm:justify-center mt-4 sm:mt-0">
                    <div className="inline-flex items-center border border-neutral-200 rounded">
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                        disabled={item.quantity <= 1}
                        className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-black hover:bg-neutral-50 disabled:opacity-30 transition-colors"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-10 text-center text-[13px] font-semibold">{item.quantity}</span>
                      <button
                        onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                        className="w-9 h-9 flex items-center justify-center text-neutral-400 hover:text-black hover:bg-neutral-50 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="hidden sm:flex justify-end">
                    <span className="text-[14px] font-extrabold text-[#111]">
                      {formatPrice(item.price * item.quantity, lang)}
                    </span>
                  </div>

                  <div className="hidden sm:flex justify-end">
                    <button
                      onClick={() => { if (confirm(lb.removeConfirm(item.name))) removeItem(item.productId); }}
                      className="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="flex sm:hidden items-center justify-between mt-3">
                    <span className="text-[13px] font-extrabold text-[#111]">
                      {formatPrice(item.price * item.quantity, lang)}
                    </span>
                    <button
                      onClick={() => { if (confirm(lb.removeConfirm(item.name))) removeItem(item.productId); }}
                      className="p-1 text-neutral-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:w-[340px] flex-shrink-0">
          <div className="lg:sticky lg:top-24 border border-neutral-100 rounded-xl p-6 sm:p-8 space-y-5">
            <h3 className="text-sm font-bold tracking-widest text-[#111] uppercase pb-4 border-b border-neutral-100">{lb.summary}</h3>

            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-neutral-500">{lb.subtotal}</span>
                <span className="font-semibold">{formatPrice(totalPrice + discountTotal, lang)}</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">{lb.discount}</span>
                  <span className="font-semibold text-[#f15a24]">-{formatPrice(discountTotal, lang)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-500">{lb.shipping}</span>
                <span className="font-semibold text-[#00693A]">{lb.free}</span>
              </div>
            </div>

            <div className="pt-5 border-t border-neutral-100">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-[#111]">{lb.grandTotal}</span>
                <span className="text-2xl font-extrabold text-[#111]">{formatPrice(totalPrice, lang)}</span>
              </div>
            </div>

            <button
              onClick={() => alert(lb.checkoutWip)}
              className="w-full py-4 bg-[#111] text-white text-[13px] font-bold tracking-widest hover:bg-black transition-colors"
            >
              {lb.checkout}
            </button>
            <Link
              href={productsHref}
              className="block w-full text-center py-3.5 border border-neutral-200 text-neutral-600 text-[13px] font-semibold hover:bg-neutral-50 transition-colors"
            >
              {lb.continueShopping}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
