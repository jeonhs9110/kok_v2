'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Lang } from '@/lib/i18n/types';
import type { CarouselSlide } from '@/lib/api/carousel';


interface HeroSliderProps {
  lang?: Lang;
  slides?: CarouselSlide[];
}

export default function HeroSlider({ lang = 'kr', slides: dbSlides }: HeroSliderProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true }, [Autoplay({ delay: 5000 })]);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const slides = (dbSlides || []).map(s => {
    const mediaType = s.media_type || (s.image_url?.match(/\.(mp4|webm|mov)$/i) ? 'video' : s.image_url?.match(/\.gif$/i) ? 'gif' : 'image');
    return {
      id: s.id,
      badge: s.badge?.[lang] || s.badge?.kr || s.badge?.en || '',
      title: s.title?.[lang] || s.title?.kr || s.title?.en || '',
      subtitle: s.subtitle?.[lang] || s.subtitle?.kr || s.subtitle?.en || '',
      image: s.image_url || '',
      bgColor: s.bg_color || '#eef4f7',
      linkUrl: s.link_url || null,
      displayMode: s.display_mode || 'default',
      mediaType,
    };
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
  }, [emblaApi, setSelectedIndex]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on('select', onSelect);
  }, [emblaApi, onSelect]);

  if (slides.length === 0) return null;

  return (
    <div className="relative w-full h-[500px] sm:h-[600px] overflow-hidden group">
      <div className="overflow-hidden h-full" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((slide) => {
            const isFullpage = slide.displayMode === 'fullpage';

            const MediaEl = slide.image ? (
              slide.mediaType === 'video' ? (
                <video
                  src={slide.image}
                  autoPlay muted loop playsInline
                  className="w-full h-full object-cover"
                />
              ) : (
                <img
                  src={slide.image}
                  alt={slide.title.replace('\n', ' ')}
                  className="w-full h-full object-cover"
                />
              )
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-sm">No Image</div>
            );

            const inner = isFullpage ? (
              /* ── Full-page mode: media fills entire banner ── */
              <div className="relative w-full h-full">
                {MediaEl}
                {/* Optional text overlay */}
                {(slide.badge || slide.title || slide.subtitle) && (
                  <div className="absolute inset-0 flex items-center">
                    <div className="max-w-[1400px] mx-auto w-full px-8">
                      <div className="max-w-lg">
                        {slide.badge && (
                          <span className="inline-block bg-black/70 text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-4 backdrop-blur-sm">
                            {slide.badge}
                          </span>
                        )}
                        {slide.title && (
                          <h2 className="text-3xl sm:text-5xl font-bold text-white leading-[1.3] whitespace-pre-line mb-3 drop-shadow-lg">
                            {slide.title}
                          </h2>
                        )}
                        {slide.subtitle && (
                          <p className="text-sm sm:text-base text-white/90 drop-shadow-md">
                            {slide.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── Default mode: text left + image right ── */
              <div className="max-w-[1400px] mx-auto h-full px-8 flex items-center justify-between">
                <div className="z-10 max-w-lg mb-10 sm:mb-0">
                  <span className="inline-block bg-[#333333] text-white text-xs font-semibold px-3 py-1.5 rounded-full mb-6 relative">
                    {slide.badge}
                  </span>
                  <h2 className="text-3xl sm:text-5xl font-bold text-gray-900 leading-[1.3] whitespace-pre-line mb-4 relative">
                    {slide.title}
                  </h2>
                  <p className="text-sm sm:text-base text-gray-700 relative">
                    {slide.subtitle}
                  </p>
                </div>
                <div className="absolute right-0 bottom-0 top-0 w-1/2 flex justify-end items-center sm:relative sm:w-auto h-full p-4 sm:p-12 opacity-80 sm:opacity-100">
                  <div className="relative h-[80%] aspect-[5/6] mr-8 shadow-2xl overflow-hidden rounded-md">
                    {slide.image ? (
                      slide.mediaType === 'video' ? (
                        <video src={slide.image} autoPlay muted loop playsInline className="object-cover w-full h-full" />
                      ) : (
                        <img src={slide.image} alt={slide.title.replace('\n', ' ')} className="object-cover w-full h-full" />
                      )
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-sm">No Image</div>
                    )}
                  </div>
                </div>
              </div>
            );

            return (
              <div key={slide.id} className="flex-[0_0_100%] min-w-0 h-full relative" style={isFullpage ? undefined : { backgroundColor: slide.bgColor }}>
                {slide.linkUrl ? (
                  <Link
                    href={slide.linkUrl}
                    target={slide.linkUrl.startsWith('http') ? '_blank' : undefined}
                    rel={slide.linkUrl.startsWith('http') ? 'noopener noreferrer' : undefined}
                    className="block w-full h-full"
                    draggable={false}
                  >
                    {inner}
                  </Link>
                ) : inner}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
        onClick={scrollPrev}
      >
        <ChevronLeft className="w-10 h-10 stroke-[1.5] drop-shadow-md" />
      </button>
      <button
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
        onClick={scrollNext}
      >
        <ChevronRight className="w-10 h-10 stroke-[1.5] drop-shadow-md" />
      </button>

      {/* Pagination Dots */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            className={`w-2 h-2 rounded-full transition-all ${
              index === selectedIndex ? 'bg-white w-6 shadow-md' : 'bg-white/50'
            }`}
            onClick={() => emblaApi && emblaApi.scrollTo(index)}
          />
        ))}
      </div>
    </div>
  );
}
