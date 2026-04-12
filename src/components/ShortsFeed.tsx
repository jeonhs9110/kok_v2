'use client';

import { useState, useRef } from 'react';
import { Play } from 'lucide-react';
import Link from 'next/link';

export interface ShortItem {
  embedUrl: string;
  productUrl?: string;
}

export default function ShortsFeed({ shorts }: { shorts: ShortItem[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!shorts || shorts.length === 0) return null;

  const handleThumbnailClick = (index: number) => {
    setActiveIndex(index);

    const container = containerRef.current;
    if (container) {
      const child = container.children[index] as HTMLElement;
      if (child) {
        const containerCenter = container.clientWidth / 2;
        const childCenter = child.offsetLeft + (child.clientWidth / 2);
        container.scrollTo({ left: childCenter - containerCenter, behavior: 'smooth' });
      }
    }
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
                  <div
                    className="group relative w-full h-full cursor-pointer"
                    onClick={() => handleThumbnailClick(index)}
                  >
                    <img
                      src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                      alt="Shorts Thumbnail"
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/40 group-hover:bg-black/20 transition-colors">
                      <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                        <Play className="w-8 h-8 text-white ml-1" fill="white" />
                      </div>
                    </div>

                    {/* Product link badge */}
                    {short.productUrl && (
                      <Link
                        href={short.productUrl}
                        onClick={(e) => e.stopPropagation()}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 hover:bg-white text-black text-[11px] font-bold px-4 py-1.5 rounded-full tracking-wide transition-colors whitespace-nowrap shadow-lg"
                      >
                        사용 제품 보기 →
                      </Link>
                    )}
                  </div>
                )}

                {(isPlaying || !videoId) && (
                  <div className="relative w-full h-full">
                    <iframe
                      src={short.embedUrl + (short.embedUrl.includes('?') ? '&autoplay=1&mute=0' : '?autoplay=1&mute=0')}
                      className="w-full h-full object-cover pointer-events-auto"
                      style={{ border: 'none' }}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                    {/* Product link on active/playing */}
                    {short.productUrl && (
                      <Link
                        href={short.productUrl}
                        className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white/90 hover:bg-white text-black text-[11px] font-bold px-4 py-1.5 rounded-full tracking-wide transition-colors whitespace-nowrap shadow-lg z-10"
                      >
                        사용 제품 보기 →
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
