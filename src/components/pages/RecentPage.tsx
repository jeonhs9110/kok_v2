'use client';

import Link from 'next/link';
import { Clock, X, Trash2 } from 'lucide-react';
import { useState, useEffect } from 'react';
import { getRecentItems, type RecentItem } from '@/components/RecentViewTracker';
import { useI18n } from '@/lib/i18n/context';

const labels: Record<string, { title: string; sub: string; empty: string; emptyDesc: string; shop: string; clear: string; clearConfirm: string }> = {
  kr: { title: '최근 본 상품', sub: '최근에 살펴본 상품들입니다.', empty: '최근 본 상품이 없습니다', emptyDesc: '상품을 둘러보세요!', shop: '쇼핑하러 가기', clear: '전체 삭제', clearConfirm: '최근 본 상품 목록을 삭제하시겠습니까?' },
  en: { title: 'Recently Viewed', sub: 'Products you recently browsed.', empty: 'No recently viewed products', emptyDesc: 'Start browsing products!', shop: 'Go Shopping', clear: 'Clear All', clearConfirm: 'Clear all recently viewed items?' },
};

function formatTimeAgo(timestamp: number, lang: string): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return lang === 'kr' ? '방금 전' : 'Just now';
  if (minutes < 60) return lang === 'kr' ? `${minutes}분 전` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return lang === 'kr' ? `${hours}시간 전` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return lang === 'kr' ? `${days}일 전` : `${days}d ago`;
}

export default function RecentPage() {
  const { lang } = useI18n();
  const lb = labels[lang] ?? labels['en'];
  const [items, setItems] = useState<RecentItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(getRecentItems());
    setMounted(true);
  }, []);

  const handleClear = () => {
    if (!confirm(lb.clearConfirm)) return;
    localStorage.removeItem('kokkok_recent');
    setItems([]);
  };

  const handleRemove = (id: string) => {
    const updated = items.filter(i => i.id !== id);
    localStorage.setItem('kokkok_recent', JSON.stringify(updated));
    setItems(updated);
  };

  if (!mounted) return null;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 animate-in fade-in duration-500">
      <div className="flex items-end justify-between mb-10 pb-8 border-b border-neutral-100">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight mb-2">{lb.title}</h1>
          <p className="text-sm text-neutral-500">{lb.sub}</p>
        </div>
        {items.length > 0 && (
          <button onClick={handleClear} className="text-[11px] text-neutral-400 hover:text-red-500 font-medium tracking-wide transition-colors">
            {lb.clear}
          </button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="py-24 flex flex-col items-center justify-center text-center">
          <div className="w-20 h-20 rounded-full bg-neutral-50 flex items-center justify-center mb-6">
            <Clock className="w-8 h-8 text-neutral-300" />
          </div>
          <h2 className="text-lg font-bold text-neutral-800 mb-1.5">{lb.empty}</h2>
          <p className="text-sm text-neutral-400 mb-8">{lb.emptyDesc}</p>
          <Link
            href={`/${lang}/products`}
            className="inline-flex items-center gap-2 px-8 py-3.5 bg-[#111] text-white text-[13px] font-bold tracking-wider hover:bg-black transition-colors"
          >
            {lb.shop}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
          {items.map(item => {
            const discount = item.originalPrice > item.price
              ? Math.round(((item.originalPrice - item.price) / item.originalPrice) * 100)
              : 0;

            return (
              <div key={item.id} className="group relative">
                {/* Remove button */}
                <button
                  onClick={() => handleRemove(item.id)}
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-full bg-white/80 backdrop-blur-sm shadow-sm flex items-center justify-center text-neutral-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3.5 h-3.5" />
                </button>

                <Link href={`/${lang}/products/${item.id}`} className="block">
                  <div className="aspect-[5/6] w-full rounded-[16px] overflow-hidden bg-[#F5F5F5] mb-3">
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ease-out" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-neutral-300 text-xs">NO IMAGE</div>
                    )}
                  </div>
                  <div className="px-1 space-y-1">
                    <h3 className="text-[13px] font-bold text-[#333] leading-tight line-clamp-2">{item.name}</h3>
                    <div className="flex items-center gap-1.5">
                      {discount > 0 && (
                        <span className="text-[14px] font-extrabold text-[#f15a24]">{discount}%</span>
                      )}
                      <span className="text-[14px] font-extrabold text-[#111]">{item.price.toLocaleString()}원</span>
                    </div>
                    {item.originalPrice > item.price && (
                      <span className="text-[12px] text-[#b5b5b5] line-through block">{item.originalPrice.toLocaleString()}원</span>
                    )}
                    <span className="text-[11px] text-neutral-400 block mt-1">{formatTimeAgo(item.viewedAt, lang)}</span>
                  </div>
                </Link>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
