'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import useEmblaCarousel from 'embla-carousel-react';
import Autoplay from 'embla-carousel-autoplay';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { Lang } from '@/lib/i18n/types';
import type { CarouselSlide } from '@/lib/api/carousel';
import { fontFamilyForKey, anchorToObjectPosition, anchorTextStyle, resolveAnchor } from '@/lib/typography/options';
import { safeUrl } from '@/lib/url/safeUrl';


/**
 * Migration 44 (2026-06-22): per-element text shadow.
 *
 * Maps the operator's 0-100 depth slider value to a CSS text-shadow
 * declaration. NULL → empty string so React drops the property and the
 * pre-migration look is preserved byte-for-byte.
 *
 * Depth split: (depth/6)px blur is roughly 0-16px (perceptually linear
 * from "wisp" to "soft"), and alpha = depth/100 gives a 0-1 opacity
 * ramp. The 2px Y offset bakes in a baseline drop so even depth=20 is
 * legible against a busy background.
 */
function textShadowCss(depth: number | null | undefined): string {
  if (depth === null || depth === undefined) return '';
  const d = Math.max(0, Math.min(100, depth));
  return `0 2px ${d / 6}px rgba(0, 0, 0, ${d / 100})`;
}

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

  // Live preview overlay — when the admin opens a slide in the
  // /admin/homepage builder drawer, every form change posts a message
  // up to the hub which forwards it here. We overlay the in-flight
  // values onto the matching slide so the central 1440px preview
  // reflects edits before save. Image swaps are post-save only (blob
  // URLs do not survive the postMessage hop). A null payload (modal
  // close) drops the overlay so the persisted slide reappears.
  const [previewOverride, setPreviewOverride] = useState<{
    slideId: string;
    override: Partial<CarouselSlide>;
  } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.parent === window) return; // Only active in the builder iframe.
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'kokkok-builder-slide-preview') return;
      if (!e.data.slideId) {
        setPreviewOverride(null);
        return;
      }
      setPreviewOverride({ slideId: e.data.slideId, override: e.data.override || {} });
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const slides = useMemo(() => (dbSlides || []).map(raw => {
    const s: CarouselSlide = previewOverride && previewOverride.slideId === raw.id
      ? { ...raw, ...previewOverride.override }
      : raw;
    const mediaType = s.media_type || (s.image_url?.match(/\.(mp4|webm|mov)$/i) ? 'video' : s.image_url?.match(/\.gif$/i) ? 'gif' : 'image');
    return {
      id: s.id,
      badge: s.badge?.[lang] || s.badge?.kr || s.badge?.en || '',
      title: s.title?.[lang] || s.title?.kr || s.title?.en || '',
      subtitle: s.subtitle?.[lang] || s.subtitle?.kr || s.subtitle?.en || '',
      image: s.image_url || '',
      // Migration 35: admin-uploaded mobile composition. Empty string
      // (or NULL row) falls back to the desktop image so pre-2026-06-10
      // slides keep rendering at every breakpoint.
      mobileImage: s.mobile_image_url || s.image_url || '',
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
      // Migration 44 (2026-06-22): per-element text shadow. NULL =
      // legacy "no shadow" — render code emits no text-shadow CSS so
      // pre-migration rows match exactly. 0-100 maps below.
      badgeShadow: textShadowCss(s.badge_shadow_depth),
      titleShadow: textShadowCss(s.title_shadow_depth),
      subtitleShadow: textShadowCss(s.subtitle_shadow_depth),
      // Migration 30: continuous text anchors. Resolved with the
      // legacy 9-cell key as a fallback so any row that hasn't been
      // re-saved through the new picker still renders correctly.
      textAnchorMobile:  resolveAnchor(s.text_anchor_mobile, s.text_position_mobile),
      textAnchorDesktop: resolveAnchor(s.text_anchor, s.text_position),
      // Image focal points — anchorToObjectPosition emits the
      // `${x}% ${y}%` string the .hero-image-focal CSS class consumes.
      imgPosMobile: anchorToObjectPosition(
        resolveAnchor(s.image_anchor_mobile, s.image_position_mobile),
      ),
      imgPosDesktop: anchorToObjectPosition(
        resolveAnchor(s.image_anchor, s.image_position),
      ),
    };
  }), [dbSlides, lang, previewOverride]);

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
        className="kokkok-hero-region w-full bg-gradient-to-br from-neutral-100 to-neutral-200 animate-pulse motion-reduce:animate-none"
        role="img"
        aria-label="Hero loading"
        aria-busy="true"
      />
    );
  }

  return (
    <div
      className="kokkok-hero-region relative w-full overflow-hidden group"
      role="region"
      aria-roledescription="carousel"
      aria-label="Featured products"
      data-builder-section="carousel"
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

            // Migration 35: separate mobile / desktop images. When the
            // admin has uploaded different files for the two breakpoints
            // we render both — only the matching one is visible per
            // Tailwind's sm: utility. Falling back to the same URL on
            // both (slide.mobileImage defaulted to slide.image in the
            // memo above) means rows from before the migration still
            // ship the desktop image at every breakpoint.
            const hasSeparateMobile = slide.mobileImage !== slide.image;
            const MediaEl = slide.image ? (
              slide.mediaType === 'video' ? (
                <>
                  <video
                    src={slide.mobileImage}
                    autoPlay muted loop playsInline
                    aria-label={slide.title.replace('\n', ' ') || 'Hero video'}
                    className={`w-full h-full object-cover hero-image-focal ${hasSeparateMobile ? 'sm:hidden' : ''}`}
                    style={focalStyle}
                  />
                  {hasSeparateMobile && (
                    <video
                      src={slide.image}
                      autoPlay muted loop playsInline
                      aria-label={slide.title.replace('\n', ' ') || 'Hero video'}
                      className="hidden sm:block w-full h-full object-cover hero-image-focal"
                      style={focalStyle}
                    />
                  )}
                </>
              ) : (
                <>
                  {/* Mobile keeps priority on the first slide — most
                      traffic is mobile and the LCP candidate that
                      shows up below the sm breakpoint should be
                      the one the browser fetches first. The desktop
                      twin (when present) gets `loading="eager"` via
                      Next.js Image's default so it still arrives
                      promptly, just without LCP priority — eliminates
                      the dual-priority Core Web Vitals fragility
                      flagged in the 2026-06-10 debug pass. */}
                  <Image
                    src={slide.mobileImage}
                    alt={slide.title.replace('\n', ' ') || ''}
                    fill
                    sizes={hasSeparateMobile ? '(max-width: 639px) 100vw, 1px' : '100vw'}
                    quality={82}
                    priority={isFirst}
                    // Round 32: non-first slides deferred so slide 2..N
                    // images don't compete with the LCP hero for
                    // bandwidth on cold visits.
                    loading={isFirst ? undefined : 'lazy'}
                    className={`object-cover hero-image-focal ${hasSeparateMobile ? 'sm:hidden' : ''}`}
                    style={focalStyle}
                  />
                  {hasSeparateMobile && (
                    <Image
                      src={slide.image}
                      alt={slide.title.replace('\n', ' ') || ''}
                      fill
                      sizes="(min-width: 640px) 100vw, 1px"
                      quality={82}
                      // Round 32: mobile visitors are the primary
                      // audience; the desktop-only twin was firing
                      // eagerly and competing with the LCP mobile
                      // image on the preload scanner even though
                      // the `hidden sm:block` class hides it visually.
                      // Explicit `loading="lazy"` keeps it out of the
                      // preload queue.
                      loading="lazy"
                      className="hidden sm:block object-cover hero-image-focal"
                      style={focalStyle}
                    />
                  )}
                </>
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
                  /* Per-breakpoint anchor — same badge/title/subtitle
                     rendered twice (mobile-only + desktop-only) so each
                     can carry its own anchorTextStyle inline placement.
                     Wrappers use sm:hidden / hidden sm:block to swap. */
                  <div className="absolute inset-0 px-8 pointer-events-none">
                    <div className="sm:hidden h-full w-full relative">
                      <div style={anchorTextStyle(slide.textAnchorMobile)}>
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
                            textShadow: slide.badgeShadow || undefined,
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
                            textShadow: slide.titleShadow || undefined,
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
                            textShadow: slide.subtitleShadow || undefined,
                            ...(slide.subtitleSizeOffset !== 0 && { ['--subtitle-fs' as string]: `calc(1rem + ${slide.subtitleSizeOffset}px)` }),
                          } as React.CSSProperties}
                        >
                          {slide.subtitle}
                        </p>
                      )}
                      </div>
                    </div>
                    <div className="hidden sm:block h-full w-full relative">
                      <div style={anchorTextStyle(slide.textAnchorDesktop)}>
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
                              textShadow: slide.badgeShadow || undefined,
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
                              fontWeight: slide.titleBold === false ? 400 : 700,
                              fontStyle: slide.titleItalic ? 'italic' : 'normal',
                              textDecoration: slide.titleUnderline ? 'underline' : 'none',
                              textShadow: slide.titleShadow || undefined,
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
                              textShadow: slide.subtitleShadow || undefined,
                              ...(slide.subtitleSizeOffset !== 0 && { ['--subtitle-fs' as string]: `calc(1rem + ${slide.subtitleSizeOffset}px)` }),
                            } as React.CSSProperties}
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
                  {/* slide.mobileImage falls back to slide.image when the
                      admin hasn't uploaded a mobile-specific composition
                      (migration 35). Either way this only renders below
                      the sm breakpoint thanks to the wrapper's sm:hidden. */}
                  {slide.mobileImage ? (
                    slide.mediaType === 'video' ? (
                      <video
                        src={slide.mobileImage}
                        autoPlay muted loop playsInline
                        className="w-full h-full object-cover hero-image-focal"
                        style={focalStyle}
                      />
                    ) : (
                      <Image
                        src={slide.mobileImage}
                        alt={slide.title.replace('\n', ' ')}
                        fill
                        sizes="100vw"
                        quality={82}
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
                          textShadow: slide.badgeShadow || undefined,
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
                        textShadow: slide.titleShadow || undefined,
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
                          textShadow: slide.subtitleShadow || undefined,
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
                            quality={82}
                            // Round 32: this default-mode desktop-framed
                            // image is inside a `hidden sm:flex` wrapper —
                            // only rendered on desktop. Mobile is the
                            // primary audience, so the priority hint
                            // stays on the mobile bg image higher up.
                            // Non-first slides always defer.
                            loading={isFirst ? undefined : 'lazy'}
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
                {(() => {
                  const safe = safeUrl(slide.linkUrl);
                  if (safe === '#') return inner;
                  const isExternal = /^https?:\/\//i.test(safe);
                  if (isExternal) {
                    // External URL → plain <a> so Next.js doesn't try to
                    // prefetch a remote origin.
                    return (
                      <a
                        href={safe}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block w-full h-full select-text"
                        draggable={false}
                      >
                        {inner}
                      </a>
                    );
                  }
                  return (
                    <Link
                      href={safe}
                      className="block w-full h-full select-text"
                      draggable={false}
                    >
                      {inner}
                    </Link>
                  );
                })()}
              </div>
            );
          })}
        </div>
      </div>

      {/* Navigation Arrows */}
      <button
        type="button"
        aria-label="Previous slide"
        className="absolute left-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white focus-visible:text-white transition-colors opacity-70 hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
        onClick={scrollPrev}
      >
        <ChevronLeft className="w-10 h-10 stroke-[1.5] drop-shadow-md" aria-hidden="true" />
      </button>
      <button
        type="button"
        aria-label="Next slide"
        className="absolute right-4 top-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center text-gray-400 hover:text-white focus-visible:text-white transition-colors opacity-70 hover:opacity-100 focus-visible:opacity-100 disabled:opacity-30"
        onClick={scrollNext}
      >
        <ChevronRight className="w-10 h-10 stroke-[1.5] drop-shadow-md" aria-hidden="true" />
      </button>

      {/* Pagination Stripes — anua.kr-style long horizontal bars.
          Each stripe is the same width; the active one fills white while
          the others read at white/40. The button keeps a 32×32 hitbox via
          the p-3 padding so mobile taps remain easy even though the
          visible stripe is just a 3px-tall line. */}
      <div className="absolute bottom-6 left-0 right-0 flex justify-center gap-1.5 sm:gap-2">
        {slides.map((_, index) => (
          <button
            key={index}
            type="button"
            aria-label={`Go to slide ${index + 1}`}
            aria-current={index === selectedIndex ? 'true' : undefined}
            className="p-3 group/stripe"
            onClick={() => emblaApi && emblaApi.scrollTo(index)}
          >
            <span
              aria-hidden="true"
              className={`block h-[3px] w-12 sm:w-16 rounded-sm transition-colors ${
                index === selectedIndex
                  ? 'bg-white shadow-md'
                  : 'bg-white/40 group-hover/stripe:bg-white/70'
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}
