'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
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

  const slides = useMemo(() => (dbSlides || []).map(s => {
    const mediaType = s.media_type || (s.image_url?.match(/\.(mp4|webm|mov)$/i) ? 'video' : s.image_url?.match(/\.gif$/i) ? 'gif' : 'image');
    return {
      id: s.id,
      badge: s.badge?.[lang] || s.badge?.kr || s.badge?.en || '',
      title: s.title?.[lang] || s.title?.kr || s.title?.en || '',
      subtitle: s.subtitle?.[lang] || s.subtitle?.kr || s.subtitle?.en || '',
      image: s.image_url || '',
      bgColor: s.bg_color || '#eef4f7',
      textColor: s.text_color || '',
      badgeBgColor: s.badge_bg_color || '',
      badgeTextColor: s.badge_text_color || '',
      titleSizeOffset: s.title_size_offset ?? 0,
      subtitleSizeOffset: s.subtitle_size_offset ?? 0,
      badgeSizeOffset: s.badge_size_offset ?? 0,
      linkUrl: s.link_url || null,
      displayMode: s.display_mode || 'default',
      mediaType,
    };
  }), [dbSlides, lang]);

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
    return () => {
      emblaApi.off('select', onSelect);
    };
  }, [emblaApi, onSelect]);

  if (slides.length === 0) {
    return (
      <div
        className="w-full h-[440px] sm:h-[600px] bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center"
        role="img"
        aria-label="Hero placeholder"
      >
        <span className="text-[11px] font-bold tracking-widest uppercase text-neutral-400">Coming soon</span>
      </div>
    );
  }

  return (
    <div
      className="relative w-full h-[440px] sm:h-[600px] overflow-hidden group"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured products"
    >
      <div className="overflow-hidden h-full" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((slide, slideIdx) => {
            const isFullpage = slide.displayMode === 'fullpage';
            const isFirst = slideIdx === 0;

            const MediaEl = slide.image ? (
              slide.mediaType === 'video' ? (
                <video
                  src={slide.image}
                  autoPlay muted loop playsInline
                  className="w-full h-full object-cover object-center"
                />
              ) : (
                <img
                  src={slide.image}
                  alt={slide.title.replace('\n', ' ') || ''}
                  width={1920}
                  height={1080}
                  loading={isFirst ? 'eager' : 'lazy'}
                  fetchPriority={isFirst ? 'high' : 'auto'}
                  className="w-full h-full object-cover object-center"
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
                          <span
                            className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full mb-4 backdrop-blur-sm"
                            style={{
                              backgroundColor: slide.badgeBgColor || 'rgba(0,0,0,0.7)',
                              color: slide.badgeTextColor || '#ffffff',
                              ...(slide.badgeSizeOffset !== 0 && { fontSize: `calc(0.75rem + ${slide.badgeSizeOffset}px)` }),
                            }}
                          >
                            {slide.badge}
                          </span>
                        )}
                        {slide.title && (
                          <h2
                            className="text-3xl sm:text-5xl font-bold leading-[1.3] whitespace-pre-line mb-3 drop-shadow-lg"
                            style={{
                              color: slide.textColor || '#ffffff',
                              ...(slide.titleSizeOffset !== 0 && { fontSize: `calc(3rem + ${slide.titleSizeOffset}px)` }),
                            }}
                          >
                            {slide.title}
                          </h2>
                        )}
                        {slide.subtitle && (
                          <p
                            className="text-sm sm:text-base drop-shadow-md"
                            style={{
                              color: slide.textColor ? slide.textColor : 'rgba(255,255,255,0.9)',
                              ...(slide.subtitleSizeOffset !== 0 && { fontSize: `calc(1rem + ${slide.subtitleSizeOffset}px)` }),
                            }}
                          >
                            {slide.subtitle}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              /* ── Default mode ──
                 Mobile (< sm): media as full-bleed background + text overlaid bottom-left
                                (avoids the cramped half-width image-on-right look).
                 Desktop (≥ sm): text left + framed image right (original look). */
              <>
                {/* Mobile background media + overlay */}
                <div className="absolute inset-0 sm:hidden">
                  {slide.image ? (
                    slide.mediaType === 'video' ? (
                      <video
                        src={slide.image}
                        autoPlay muted loop playsInline
                        className="w-full h-full object-cover object-center"
                      />
                    ) : (
                      <img
                        src={slide.image}
                        alt={slide.title.replace('\n', ' ')}
                        loading={isFirst ? 'eager' : 'lazy'}
                        fetchPriority={isFirst ? 'high' : 'auto'}
                        className="w-full h-full object-cover object-center"
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                  {/* Subtle bottom gradient so the text stays legible regardless of image */}
                  <div className="absolute inset-0 bg-gradient-to-t from-white/85 via-white/30 to-transparent" />
                </div>

                {/* Text + (desktop) framed image */}
                <div className="relative max-w-[1400px] mx-auto h-full px-6 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-end sm:justify-between pb-10 sm:pb-0">
                  <div className="z-10 max-w-lg">
                    {slide.badge && (
                      <span
                        className="inline-block text-xs font-semibold px-3 py-1.5 rounded-full mb-4 sm:mb-6"
                        style={{
                          backgroundColor: slide.badgeBgColor || '#333333',
                          color: slide.badgeTextColor || '#ffffff',
                          ...(slide.badgeSizeOffset !== 0 && { fontSize: `calc(0.75rem + ${slide.badgeSizeOffset}px)` }),
                        }}
                      >
                        {slide.badge}
                      </span>
                    )}
                    <h2
                      className="text-2xl sm:text-5xl font-bold leading-[1.3] whitespace-pre-line mb-3 sm:mb-4"
                      style={{
                        color: slide.textColor || '#111827',
                        ...(slide.titleSizeOffset !== 0 && { fontSize: `calc(3rem + ${slide.titleSizeOffset}px)` }),
                      }}
                    >
                      {slide.title}
                    </h2>
                    {slide.subtitle && (
                      <p
                        className="text-[13px] sm:text-base"
                        style={{
                          color: slide.textColor || '#374151',
                          ...(slide.subtitleSizeOffset !== 0 && { fontSize: `calc(1rem + ${slide.subtitleSizeOffset}px)` }),
                        }}
                      >
                        {slide.subtitle}
                      </p>
                    )}
                  </div>
                  {/* Desktop-only framed image on right */}
                  <div className="hidden sm:flex relative w-auto h-full p-12 justify-end items-center">
                    <div className="relative h-[80%] aspect-[5/6] mr-8 shadow-2xl overflow-hidden rounded-md">
                      {slide.image ? (
                        slide.mediaType === 'video' ? (
                          <video src={slide.image} autoPlay muted loop playsInline className="object-cover w-full h-full" />
                        ) : (
                          <img
                            src={slide.image}
                            alt={slide.title.replace('\n', ' ')}
                            loading={isFirst ? 'eager' : 'lazy'}
                            fetchPriority={isFirst ? 'high' : 'auto'}
                            className="object-cover w-full h-full"
                          />
                        )
                      ) : (
                        <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-sm">No Image</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
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
        type="button"
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
        onClick={scrollPrev}
      >
        <ChevronLeft className="w-10 h-10 stroke-[1.5] drop-shadow-md" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 disabled:opacity-30"
        onClick={scrollNext}
      >
        <ChevronRight className="w-10 h-10 stroke-[1.5] drop-shadow-md" aria-hidden="true" />
      </button>

      {/* Pagination Dots */}
      <div className="absolute bottom-8 left-0 right-0 flex justify-center space-x-2">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === selectedIndex ? 'true' : undefined}
            className={`h-2 rounded-full transition-all ${
              index === selectedIndex ? 'bg-white w-6 shadow-md' : 'bg-white/50 w-2'
            }`}
            onClick={() => emblaApi && emblaApi.scrollTo(index)}
          />
        ))}
      </div>
    </div>
  );
}
