'use client';

import { useEffect, useState, useRef } from 'react';
import { Play } from 'lucide-react';
import Link from 'next/link';
import { useI18n } from '@/lib/i18n/context';

export interface ShortItem {
  embedUrl: string;
  productUrl?: string;
}

export default function ShortsFeed({ shorts }: { shorts: ShortItem[] }) {
  const { lang } = useI18n();
  const viewLabel = lang === 'kr' ? '사용 제품 보기 →' : 'View product →';
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    };
  }, []);

  if (!shorts || shorts.length === 0) return null;

  const handleThumbnailClick = (index: number) => {
    setActiveIndex(index);
    // Rapid clicks across thumbnails would otherwise stack smooth-scroll
    // animations. Coalesce to the latest target via rAF.
    if (scrollRafRef.current !== null) cancelAnimationFrame(scrollRafRef.current);
    scrollRafRef.current = requestAnimationFrame(() => {
      scrollRafRef.current = null;
      const container = containerRef.current;
      if (!container) return;
      const child = container.children[index] as HTMLElement | undefined;
      if (!child) return;
      const containerCenter = container.clientWidth / 2;
      const childCenter = child.offsetLeft + (child.clientWidth / 2);
      container.scrollTo({ left: childCenter - containerCenter, behavior: 'smooth' });
    });
  };

  return (
    <section className="py-16 md:py-24 bg-neutral-900 overflow-hidden">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center items-end mb-10">
          <h2 className="text-white text-[15px] font-bold tracking-widest uppercase">
            BRAND SHORTS
          </h2>
        </div>

        <div
          ref={containerRef}
          className="flex overflow-x-auto space-x-6 pb-8 snap-x no-scrollbar justify-center"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {shorts.map((short, index) => {
            const match = short.embedUrl.match(/\/embed\/([a-zA-Z0-9_-]+)/);
            const videoId = match ? match[1] : null;
            const isPlaying = activeIndex === index;

            return (
              <div
                key={index}
                className={`flex-none w-[260px] h-[460px] rounded-[24px] overflow-hidden bg-black snap-center relative shadow-2xl transition-all duration-500 ease-in-out ${isPlaying ? 'scale-[1.02] ring-2 ring-white z-10' : 'opacity-60 hover:opacity-100 hover:scale-[1.01] ring-1 ring-white/10'}`}
              >
                {!isPlaying && videoId && (
                  <div className="relative w-full h-full">
                    <button
                      type="button"
                      onClick={() => handleThumbnailClick(index)}
                      aria-label={lang === 'kr' ? '영상 재생' : 'Play video'}
                      className="group absolute inset-0 w-full h-full block cursor-pointer"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                        alt=""
                        width={480}
                        height={360}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                        <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                          <Play className="w-8 h-8 text-white ml-1" fill="white" aria-hidden="true" />
                        </div>
                      </div>
                    </button>

                    {short.productUrl && (
                      <Link
                        href={short.productUrl}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 bg-white/90 hover:bg-white text-black text-[11px] font-bold px-4 py-1.5 rounded-full tracking-wide transition-colors whitespace-nowrap shadow-lg"
                      >
                        {viewLabel}
                      </Link>
                    )}
                  </div>
                )}

                {(isPlaying || !videoId) && (
                  <div className="relative w-full h-full">
                    <iframe
                      src={short.embedUrl + (short.embedUrl.includes('?') ? '&autoplay=1&mute=1' : '?autoplay=1&mute=1')}
                      title={lang === 'kr' ? '브랜드 쇼츠 영상' : 'Brand shorts video'}
                      className="w-full h-full object-cover pointer-events-auto"
                      style={{ border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                    {short.productUrl && (
                      <Link
                        href={short.productUrl}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 hover:bg-white text-black text-[11px] font-bold px-4 py-1.5 rounded-full tracking-wide transition-colors whitespace-nowrap shadow-lg z-10"
                      >
                        {viewLabel}
                      </Link>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
