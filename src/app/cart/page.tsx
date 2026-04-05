'use client';

import Link from 'next/link';
import { Trash2, Minus, Plus, ShoppingBag, ArrowLeft, X, ChevronRight } from 'lucide-react';
import { CartProvider, useCart } from '@/lib/cart/CartContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { I18nProvider } from '@/lib/i18n/context';

function CartContent() {
  const { items, updateQuantity, removeItem, clearCart, totalPrice, totalCount } = useCart();

  if (items.length === 0) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
        <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
          <Link href="/kr" className="hover:text-black transition-colors">HOME</Link>
          <ChevronRight className="w-3 h-3 mx-2" />
          <span className="text-[#111]">장바구니</span>
        </div>

        <div className="min-h-[50vh] flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-neutral-50 flex items-center justify-center mb-6">
            <ShoppingBag className="w-8 h-8 text-neutral-300" />
          </div>
          <h2 className="text-xl font-extrabold text-[#111] mb-2">장바구니가 비어있습니다</h2>
          <p className="text-sm text-neutral-400 mb-8">마음에 드는 상품을 담아보세요</p>
          <Link
            href="/kr/products"
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#111] text-white text-[13px] font-bold tracking-wider hover:bg-black transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> 쇼핑하러 가기
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
      {/* Breadcrumb */}
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest">
        <Link href="/kr" className="hover:text-black transition-colors">HOME</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-[#111]">장바구니</span>
      </div>

      {/* Title */}
      <div className="flex items-end justify-between mb-8 pb-6 border-b-2 border-[#111]">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-[#111]">장바구니</h1>
          <p className="text-xs text-neutral-400 mt-2">총 {totalCount}개의 상품</p>
        </div>
        <button
          onClick={() => { if (confirm('장바구니를 비우시겠습니까?')) clearCart(); }}
          className="text-[11px] text-neutral-400 hover:text-red-500 font-semibold tracking-wide transition-colors"
        >
          전체 삭제
        </button>
      </div>

      <div className="flex flex-col lg:flex-row gap-10 lg:gap-14">
        {/* Items List */}
        <div className="flex-1">
          {/* Table header - desktop */}
          <div className="hidden sm:grid grid-cols-[1fr_120px_140px_60px] gap-4 pb-3 text-[11px] font-bold tracking-widest text-neutral-400 uppercase border-b border-neutral-100">
            <span>상품 정보</span>
            <span className="text-center">수량</span>
            <span className="text-right">금액</span>
            <span className="text-right">삭제</span>
          </div>

          <div className="divide-y divide-neutral-100">
            {items.map(item => {
              const discount = item.originalPrice > item.price
                ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
                : 0;

              return (
                <div key={item.productId} className="py-6 sm:grid sm:grid-cols-[1fr_120px_140px_60px] sm:gap-4 sm:items-center">
                  {/* Product info */}
                  <div className="flex gap-4">
                    <Link href={`/kr/products/${item.productId}`} className="flex-shrink-0">
                      <div className="w-[80px] h-[100px] sm:w-[90px] sm:h-[112px] rounded overflow-hidden bg-[#F5F5F5]">
                        {item.imageUrl ? (
                          <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover mix-blend-multiply" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <ShoppingBag className="w-5 h-5 text-neutral-300" />
                          </div>
                        )}
                      </div>
                    </Link>
                    <div className="flex flex-col justify-center min-w-0">
                      <Link href={`/kr/products/${item.productId}`} className="hover:underline underline-offset-2">
                        <h3 className="text-[13px] font-bold text-[#111] leading-snug line-clamp-2">{item.name}</h3>
                      </Link>
                      <div className="flex items-center gap-2 mt-2">
                        {discount > 0 && (
                          <span className="text-[13px] font-extrabold text-[#f15a24]">{discount}%</span>
                        )}
                        <span className="text-[14px] font-extrabold text-[#111]">{item.price.toLocaleString()}원</span>
                      </div>
                      {item.originalPrice > item.price && (
                        <span className="text-[12px] text-neutral-400 line-through mt-0.5">{item.originalPrice.toLocaleString()}원</span>
                      )}
                    </div>
                  </div>

                  {/* Quantity */}
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

                  {/* Subtotal */}
                  <div className="hidden sm:flex justify-end">
                    <span className="text-[14px] font-extrabold text-[#111]">
                      {(item.price * item.quantity).toLocaleString()}원
                    </span>
                  </div>

                  {/* Delete */}
                  <div className="hidden sm:flex justify-end">
                    <button
                      onClick={() => { if (confirm(`"${item.name}" 을(를) 삭제하시겠습니까?`)) removeItem(item.productId); }}
                      className="w-8 h-8 flex items-center justify-center text-neutral-300 hover:text-red-500 transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Mobile: subtotal + delete row */}
                  <div className="flex sm:hidden items-center justify-between mt-3">
                    <span className="text-[13px] font-extrabold text-[#111]">
                      {(item.price * item.quantity).toLocaleString()}원
                    </span>
                    <button
                      onClick={() => { if (confirm(`"${item.name}" 을(를) 삭제하시겠습니까?`)) removeItem(item.productId); }}
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

        {/* Order Summary Sidebar */}
        <div className="lg:w-[340px] flex-shrink-0">
          <div className="lg:sticky lg:top-24 border border-neutral-100 rounded-xl p-6 sm:p-8 space-y-5">
            <h3 className="text-sm font-bold tracking-widest text-[#111] uppercase pb-4 border-b border-neutral-100">주문 요약</h3>

            <div className="space-y-3 text-[13px]">
              <div className="flex justify-between">
                <span className="text-neutral-500">상품 금액</span>
                <span className="font-semibold">{(totalPrice + discountTotal).toLocaleString()}원</span>
              </div>
              {discountTotal > 0 && (
                <div className="flex justify-between">
                  <span className="text-neutral-500">할인 금액</span>
                  <span className="font-semibold text-[#f15a24]">-{discountTotal.toLocaleString()}원</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-neutral-500">배송비</span>
                <span className="font-semibold text-[#4a7a3e]">무료</span>
              </div>
            </div>

            <div className="pt-5 border-t border-neutral-100">
              <div className="flex justify-between items-end">
                <span className="text-sm font-bold text-[#111]">총 결제금액</span>
                <span className="text-2xl font-extrabold text-[#111]">{totalPrice.toLocaleString()}<span className="text-base ml-0.5">원</span></span>
              </div>
            </div>

            <button
              onClick={() => alert('결제 기능은 준비 중입니다.')}
              className="w-full py-4 bg-[#111] text-white text-[13px] font-bold tracking-widest hover:bg-black transition-colors"
            >
              결제하기
            </button>
            <Link
              href="/kr/products"
              className="block w-full text-center py-3.5 border border-neutral-200 text-neutral-600 text-[13px] font-semibold hover:bg-neutral-50 transition-colors"
            >
              쇼핑 계속하기
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CartPage() {
  return (
    <I18nProvider isKorea={true} lang="kr">
      <CartProvider>
        <div className="min-h-screen bg-white flex flex-col font-sans">
          <Header canPurchase={true} />
          <main className="flex-1 bg-white">
            <CartContent />
          </main>
          <Footer />
        </div>
      </CartProvider>
    </I18nProvider>
  );
}
