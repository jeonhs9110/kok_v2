'use client';

import { useEffect, useRef, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface ActiveBg {
  file_url: string;
  file_type: 'image' | 'video';
  scroll_driven?: boolean;
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
 */
export default function SiteBackground() {
  const [bg, setBg] = useState<ActiveBg | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Fetch active background row once on mount.
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('site_backgrounds')
          .select('file_url, file_type, scroll_driven')
          .eq('is_active', true)
          .maybeSingle();
        if (data) setBg(data as ActiveBg);
      } catch { /* silent — falls back to no background */ }
    })();
  }, []);

  // Scroll-driven playback: map scrollY to video.currentTime via rAF.
  // Only runs for videos with scroll_driven=true; auto-loop videos are
  // unaffected.
  useEffect(() => {
    if (!bg || bg.file_type !== 'video' || !bg.scroll_driven) return;
    const video = videoRef.current;
    if (!video) return;

    let rafId: number | null = null;
    let lastScroll = -1;

    const tick = () => {
      const scrollY = window.scrollY;
      // Only seek when scroll position actually changed — avoids hammering
      // the decoder when the user isn't moving.
      if (scrollY !== lastScroll) {
        const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
        const ratio = Math.min(1, Math.max(0, scrollY / maxScroll));
        const duration = video.duration;
        if (duration && Number.isFinite(duration)) {
          video.currentTime = duration * ratio;
        }
        lastScroll = scrollY;
      }
      rafId = requestAnimationFrame(tick);
    };

    // Kick a first tick once metadata is ready so duration is known.
    const onReady = () => {
      if (rafId === null) rafId = requestAnimationFrame(tick);
    };
    if (video.readyState >= 1 /* HAVE_METADATA */) {
      onReady();
    } else {
      video.addEventListener('loadedmetadata', onReady, { once: true });
    }

    return () => {
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
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg.file_url} alt="" className="w-full h-full object-cover" />
      )}
    </div>
  );
}
