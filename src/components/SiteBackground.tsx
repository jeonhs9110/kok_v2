'use client';

import { useEffect, useRef } from 'react';
import Image from 'next/image';

interface ActiveBg {
  file_url: string;
  file_type: 'image' | 'video';
  scroll_driven?: boolean;
}

interface Props {
  /** SSR'd by app/layout.tsx via getActiveSiteBackground. NULL when no
   *  active row exists — component renders the solid white fallback. */
  initialBg: ActiveBg | null;
}

/**
 * Fixed full-viewport background that sits behind every page.
 * Reads the one active row from `site_backgrounds`; renders a white layer
 * as a fallback when none.
 *
 * Two playback modes for video:
 *   - Default: autoplay muted loop (object-cover, fills viewport).
 *   - scroll_driven: video.currentTime is bound to page scroll position,
 *     Apple-style. Disables autoplay/loop, preloads the file, and uses
 *     requestAnimationFrame to scrub frames as the user scrolls.
 *
 * Performance audit 2026-06-19 — previously fetched site_backgrounds
 * client-side on mount (~1.3s blocking Supabase call seen in WebPageTest).
 * Now SSR'd by app/layout via getActiveSiteBackground (unstable_cache
 * 60s + tag eviction); this component just consumes the prop.
 */
export default function SiteBackground({ initialBg }: Props) {
  const bg = initialBg;
  const videoRef = useRef<HTMLVideoElement>(null);

  // Scroll-driven playback: map scrollY to video.currentTime via rAF.
  // Only runs for videos with scroll_driven=true; auto-loop videos are
  // unaffected.
  //
  // Round 23: was previously re-arming rAF unconditionally at the end
  // of every tick — main thread never idled, INP +5-15ms/interaction
  // + measurable battery drain. Now rAF is only scheduled when a
  // scroll event fires; the loop self-terminates when the user stops
  // scrolling.
  useEffect(() => {
    if (!bg || bg.file_type !== 'video' || !bg.scroll_driven) return;
    const video = videoRef.current;
    if (!video) return;

    let rafId: number | null = null;
    let lastScroll = -1;

    const tick = () => {
      rafId = null;
      const scrollY = window.scrollY;
      if (scrollY !== lastScroll) {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const ratio = Math.min(1, Math.max(0, scrollY / maxScroll));
        const duration = video.duration;
        if (duration && Number.isFinite(duration)) {
          video.currentTime = duration * ratio;
        }
        lastScroll = scrollY;
      }
    };

    const schedule = () => {
      if (rafId === null) rafId = requestAnimationFrame(tick);
    };

    // Kick one initial seek so the frame at scroll=0 lines up.
    const onReady = () => schedule();
    if (video.readyState >= 1 /* HAVE_METADATA */) {
      onReady();
    } else {
      video.addEventListener('loadedmetadata', onReady, { once: true });
    }

    window.addEventListener('scroll', schedule, { passive: true });

    return () => {
      window.removeEventListener('scroll', schedule);
      if (rafId !== null) cancelAnimationFrame(rafId);
      video.removeEventListener('loadedmetadata', onReady);
    };
  }, [bg]);

  // Default fallback: solid white -z-10 layer when no active background.
  if (!bg) {
    return (
      <div
        className="fixed inset-0 -z-10 bg-white pointer-events-none"
        aria-hidden="true"
      />
    );
  }

  const isScrollVideo = bg.file_type === 'video' && bg.scroll_driven;

  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-white" aria-hidden="true">
      {bg.file_type === 'video' ? (
        <video
          ref={videoRef}
          src={bg.file_url}
          className="w-full h-full object-cover"
          muted
          playsInline
          // Scroll-driven mode: do NOT autoplay/loop; preload the whole
          // file so seeking is smooth from the first scroll.
          // Default mode: autoplay muted loop forever.
          {...(isScrollVideo
            ? { preload: 'auto' as const }
            : { loop: true, autoPlay: true })}
        />
      ) : (
        // Full-viewport background image; `fill` lets next/image stretch
        // to the parent while still serving AVIF/WebP variants. priority
        // because this is above-the-fold on every storefront route — we
        // want the browser to fetch it on the LCP critical path, not
        // after the lazy-load observer fires.
        <Image
          src={bg.file_url}
          alt=""
          fill
          sizes="100vw"
          priority
          className="object-cover"
        />
      )}
    </div>
  );
}
