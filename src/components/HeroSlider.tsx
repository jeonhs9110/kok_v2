'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Lang } from '@/lib/i18n/types';
import type { CarouselSlide } from '@/lib/api/carousel';
import { fontFamilyForKey, positionForKey, positionDesktopForKey, objectPositionForKey } from '@/lib/typography/options';


interface HeroSliderProps {
  lang?: Lang;
  slides?: CarouselSlide[];
}

export default function HeroSlider({ lang = 'kr', slides: dbSlides }: HeroSliderProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel(
    { loop: true },
    [Autoplay({
      delay: 5000,
      stopOnMouseEnter: true,
      stopOnFocusIn: true,
      stopOnInteraction: false,
    })]
  );
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
      // Phase 3 typography. Render code below merges these into the
      // existing style objects so rows from before migration 25 fall
      // back to the previous look automatically.
      badgeFontFamily: fontFamilyForKey(s.badge_font_family),
      titleFontFamily: fontFamilyForKey(s.title_font_family),
      subtitleFontFamily: fontFamilyForKey(s.subtitle_font_family),
      badgeBold: s.badge_bold ?? false,
      badgeItalic: s.badge_italic ?? false,
      badgeUnderline: s.badge_underline ?? false,
      titleBold: s.title_bold ?? true,
      titleItalic: s.title_italic ?? false,
      titleUnderline: s.title_underline ?? false,
      subtitleBold: s.subtitle_bold ?? false,
      subtitleItalic: s.subtitle_italic ?? false,
      subtitleUnderline: s.subtitle_underline ?? false,
      // Mobile uses the unprefixed PositionOption (applies at xs).
      // Desktop uses the sm:-prefixed lookup so the same template
      // string holds both breakpoints' flex utilities.
      positionMobile: positionForKey(s.text_position_mobile),
      positionDesktop: positionDesktopForKey(s.text_position),
      // Migration 29: per-breakpoint image focal point. Render code
      // pipes these into `--img-pos-mobile` / `--img-pos-desktop` CSS
      // variables that the .hero-image-focal class consumes via a
      // breakpoint-aware object-position rule in globals.css.
      imgPosMobile: objectPositionForKey(s.image_position_mobile),
      imgPosDesktop: objectPositionForKey(s.image_position),
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
    // SSR always passes the cached slides array (with a [] fallback on DB
    // failure). If we land here client-side after a non-empty SSR render,
    // it means hydration replaced the SSR DOM with this branch — log so we
    // can catch transient cache misses or prop-serialization issues.
    if (typeof window !== 'undefined') {
      console.warn('[HeroSlider] rendered with 0 slides');
    }
    return (
      <div
        className="w-full h-[600px] sm:h-[780px] lg:h-[880px] bg-gradient-to-br from-neutral-100 to-neutral-200 animate-pulse motion-reduce:animate-none"
        role="img"
        aria-label="Hero loading"
        aria-busy="true"
      />
    );
  }

  return (
    <div
      className="relative w-full h-[600px] sm:h-[780px] lg:h-[880px] overflow-hidden group"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured products"
    >
      <div className="overflow-hidden h-full" ref={emblaRef}>
        <div className="flex h-full">
          {slides.map((slide, slideIdx) => {
            const isFullpage = slide.displayMode === 'fullpage';
            const isFirst = slideIdx === 0;

            // Build the object-position CSS vars once per slide; spread
            // them onto every media element so admin-picked focal point
            // applies across fullpage img/video AND default-mode mobile
            // bg + desktop framed image. The hero-image-focal class in
            // globals.css consumes both vars via a breakpoint switch.
            const focalStyle = {
              ['--img-pos-mobile' as string]: slide.imgPosMobile,
              ['--img-pos-desktop' as string]: slide.imgPosDesktop,
            } as React.CSSProperties;

            const MediaEl = slide.image ? (
              slide.mediaType === 'video' ? (
                <video
                  src={slide.image}
                  autoPlay muted loop playsInline
                  aria-label={slide.title.replace('\n', ' ') || 'Hero video'}
                  className="w-full h-full object-cover hero-image-focal"
                  style={focalStyle}
                />
              ) : (
                <Image
                  src={slide.image}
                  alt={slide.title.replace('\n', ' ') || ''}
                  fill
                  sizes="100vw"
                  quality={95}
                  priority={isFirst}
                  className="object-cover hero-image-focal"
                  style={focalStyle}
                />
              )
            ) : (
              <div className="w-full h-full bg-gray-200 flex items-center justify-center text-gray-400 text-sm">No Image</div>
            );

            const inner = isFullpage ? (
              /* ── Full-page mode: media fills entire banner ──
                 Phase 3: position picker drives where the text block
                 sits inside the slide (9-cell anchor). Per-block font /
                 weight / italic / underline read off slide.titleBold etc.
                 Defaults reproduce the pre-Phase-3 look (center, bold
                 white title, regular subtitle, semi-bold badge). */
              <div className="relative w-full h-full">
                {MediaEl}
                {(slide.badge || slide.title || slide.subtitle) && (
                  <div className={`absolute inset-0 flex flex-col px-8 ${slide.positionMobile.align} ${slide.positionDesktop.align} ${slide.positionMobile.justify} ${slide.positionDesktop.justify} ${slide.positionMobile.textAlign} ${slide.positionDesktop.textAlign}`}>
                    <div className="max-w-lg">
                      {slide.badge && (
                        <span
                          className={`inline-block text-xs px-3 py-1.5 rounded-full mb-4 backdrop-blur-sm ${slide.badgeSizeOffset !== 0 ? 'sm:text-[length:var(--badge-fs)]' : ''}`}
                          style={{
                            backgroundColor: slide.badgeBgColor || 'rgba(0,0,0,0.7)',
                            color: slide.badgeTextColor || '#ffffff',
                            fontFamily: slide.badgeFontFamily,
                            fontWeight: slide.badgeBold ? 700 : 600,
                            fontStyle: slide.badgeItalic ? 'italic' : 'normal',
                            textDecoration: slide.badgeUnderline ? 'underline' : 'none',
                            ...(slide.badgeSizeOffset !== 0 && { ['--badge-fs' as string]: `calc(0.75rem + ${slide.badgeSizeOffset}px)` }),
                          } as React.CSSProperties}
                        >
                          {slide.badge}
                        </span>
                      )}
                      {slide.title && (
                        <h2
                          className={`text-3xl sm:text-5xl leading-[1.3] whitespace-pre-line max-w-full mb-3 drop-shadow-lg [word-break:keep-all] [overflow-wrap:break-word] ${slide.titleSizeOffset !== 0 ? 'sm:text-[length:var(--title-fs)]' : ''}`}
                          style={{
                            color: slide.textColor || '#ffffff',
                            fontFamily: slide.titleFontFamily,
                            // 700 matches the original `font-bold` class
                            // this h2 used before Phase 3 swapped class
                            // weight for inline weight. Default-mode h2
                            // below already used 700; this brings the
                            // fullpage path to parity so admin-untouched
                            // slides paint the same as they did pre-PR.
                            fontWeight: slide.titleBold === false ? 400 : 700,
                            fontStyle: slide.titleItalic ? 'italic' : 'normal',
                            textDecoration: slide.titleUnderline ? 'underline' : 'none',
                            ...(slide.titleSizeOffset !== 0 && { ['--title-fs' as string]: `calc(3rem + ${slide.titleSizeOffset}px)` }),
                          } as React.CSSProperties}
                        >
                          {slide.title}
                        </h2>
                      )}
                      {slide.subtitle && (
                        <p
                          className={`text-sm sm:text-base drop-shadow-md ${slide.subtitleSizeOffset !== 0 ? 'sm:text-[length:var(--subtitle-fs)]' : ''}`}
                          style={{
                            color: slide.textColor ? slide.textColor : 'rgba(255,255,255,0.9)',
                            fontFamily: slide.subtitleFontFamily,
                            fontWeight: slide.subtitleBold ? 700 : 400,
                            fontStyle: slide.subtitleItalic ? 'italic' : 'normal',
                            textDecoration: slide.subtitleUnderline ? 'underline' : 'none',
                            ...(slide.subtitleSizeOffset !== 0 && { ['--subtitle-fs' as string]: `calc(1rem + ${slide.subtitleSizeOffset}px)` }),
                          } as React.CSSProperties}
                        >
                          {slide.subtitle}
                        </p>
                      )}
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
                {/* Mobile background media + overlay
                    Previously cropped with object-right to keep
                    desktop-first product images on-screen, but that
                    auto-shifted everything sideways on mobile. With
                    migration 27 the admin now controls text placement
                    per breakpoint, so the image stays centered and the
                    admin moves the text away from the product instead.
                    The legibility gradient is localized to the
                    bottom-left text region in a dark tone — works for
                    both bright and dark images. */}
                <div className="absolute inset-0 sm:hidden">
                  {slide.image ? (
                    slide.mediaType === 'video' ? (
                      <video
                        src={slide.image}
                        autoPlay muted loop playsInline
                        className="w-full h-full object-cover hero-image-focal"
                        style={focalStyle}
                      />
                    ) : (
                      <Image
                        src={slide.image}
                        alt={slide.title.replace('\n', ' ')}
                        fill
                        sizes="100vw"
                        quality={95}
                        priority={isFirst}
                        className="object-cover hero-image-focal"
                        style={focalStyle}
                      />
                    )
                  ) : (
                    <div className="w-full h-full bg-gray-200" />
                  )}
                  <div className="absolute inset-x-0 bottom-0 h-3/5 bg-gradient-to-t from-black/65 via-black/35 to-transparent" />
                </div>

                {/* Text + (desktop) framed image */}
                <div className="relative max-w-[1400px] mx-auto h-full px-6 sm:px-8 flex flex-col sm:flex-row items-start sm:items-center justify-end sm:justify-between pb-10 sm:pb-0">
                  <div className="z-10 max-w-lg">
                    {slide.badge && (
                      <span
                        className={`inline-block text-xs px-3 py-1.5 rounded-full mb-4 sm:mb-6 ${slide.badgeSizeOffset !== 0 ? 'sm:text-[length:var(--badge-fs)]' : ''}`}
                        style={{
                          backgroundColor: slide.badgeBgColor || '#333333',
                          color: slide.badgeTextColor || '#ffffff',
                          fontFamily: slide.badgeFontFamily,
                          fontWeight: slide.badgeBold ? 700 : 600,
                          fontStyle: slide.badgeItalic ? 'italic' : 'normal',
                          textDecoration: slide.badgeUnderline ? 'underline' : 'none',
                          ...(slide.badgeSizeOffset !== 0 && { ['--badge-fs' as string]: `calc(0.75rem + ${slide.badgeSizeOffset}px)` }),
                        } as React.CSSProperties}
                      >
                        {slide.badge}
                      </span>
                    )}
                    {/* Mobile uses white text with a drop shadow against
                        the dark gradient overlay above — the admin's
                        textColor is sized for the desktop bgColor, which
                        doesn't apply once an image fills the slide. The
                        admin color is preserved at sm+ via a CSS var. */}
                    <h2
                      className={`text-2xl sm:text-5xl leading-[1.3] whitespace-pre-line max-w-full mb-3 sm:mb-4 [word-break:keep-all] [overflow-wrap:break-word] text-white sm:text-[color:var(--title-color)] drop-shadow-md sm:drop-shadow-none ${slide.titleSizeOffset !== 0 ? 'sm:text-[length:var(--title-fs)]' : ''}`}
                      style={{
                        ['--title-color' as string]: slide.textColor || '#111827',
                        fontFamily: slide.titleFontFamily,
                        fontWeight: slide.titleBold === false ? 400 : 700,
                        fontStyle: slide.titleItalic ? 'italic' : 'normal',
                        textDecoration: slide.titleUnderline ? 'underline' : 'none',
                        ...(slide.titleSizeOffset !== 0 && { ['--title-fs' as string]: `calc(3rem + ${slide.titleSizeOffset}px)` }),
                      } as React.CSSProperties}
                    >
                      {slide.title}
                    </h2>
                    {slide.subtitle && (
                      <p
                        className={`text-[13px] sm:text-base text-white/90 sm:text-[color:var(--subtitle-color)] drop-shadow sm:drop-shadow-none ${slide.subtitleSizeOffset !== 0 ? 'sm:text-[length:var(--subtitle-fs)]' : ''}`}
                        style={{
                          ['--subtitle-color' as string]: slide.textColor || '#374151',
                          fontFamily: slide.subtitleFontFamily,
                          fontWeight: slide.subtitleBold ? 700 : 400,
                          fontStyle: slide.subtitleItalic ? 'italic' : 'normal',
                          textDecoration: slide.subtitleUnderline ? 'underline' : 'none',
                          ...(slide.subtitleSizeOffset !== 0 && { ['--subtitle-fs' as string]: `calc(1rem + ${slide.subtitleSizeOffset}px)` }),
                        } as React.CSSProperties}
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
                          <Image
                            src={slide.image}
                            alt={slide.title.replace('\n', ' ')}
                            fill
                            sizes="(max-width: 1024px) 50vw, 40vw"
                            quality={95}
                            priority={isFirst}
                            className="object-cover"
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
                  slide.linkUrl.startsWith('http') ? (
                    // External URL → plain <a> so Next.js doesn't try to
                    // prefetch a remote origin.
                    <a
                      href={slide.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block w-full h-full select-text"
                      draggable={false}
                    >
                      {inner}
                    </a>
                  ) : (
                    <Link
                      href={slide.linkUrl}
                      className="block w-full h-full select-text"
                      draggable={false}
                    >
                      {inner}
                    </Link>
                  )
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
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white focus-visible:text-white transition-colors opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
        onClick={scrollPrev}
      >
        <ChevronLeft className="w-10 h-10 stroke-[1.5] drop-shadow-md" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white focus-visible:text-white transition-colors opacity-70 sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
        onClick={scrollNext}
      >
        <ChevronRight className="w-10 h-10 stroke-[1.5] drop-shadow-md" aria-hidden="true" />
      </button>

      {/* Pagination Dots — visible dot stays tiny, but hitbox is 32×32 via padding */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === selectedIndex ? 'true' : undefined}
            className="p-3 group/dot"
            onClick={() => emblaApi && emblaApi.scrollTo(index)}
          >
            <span
              aria-hidden="true"
              className={`block h-2 rounded-full transition-all ${
                index === selectedIndex
                  ? 'bg-white w-6 shadow-md'
                  : 'bg-white/60 w-2 group-hover/dot:bg-white/90'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
