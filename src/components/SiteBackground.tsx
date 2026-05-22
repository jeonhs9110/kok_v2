'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface ActiveBg {
  file_url: string;
  file_type: 'image' | 'video';
}

/**
 * Fixed full-viewport background that sits behind every page.
 * Reads the one active row from `site_backgrounds`; renders nothing if none.
 *
 * Note: the storefront layout uses opaque white/cream cards over the whole
 * page, so this background will only be visible where content above it is
 * transparent. For the active background to actually be visible to users,
 * pages over it need to expose transparent gutters/edges.
 */
export default function SiteBackground() {
  const [bg, setBg] = useState<ActiveBg | null>(null);

  useEffect(() => {
    if (!supabase) return;
    (async () => {
      try {
        const { data } = await supabase
          .from('site_backgrounds')
          .select('file_url, file_type')
          .eq('is_active', true)
          .maybeSingle();
        if (data) setBg(data as ActiveBg);
      } catch { /* silent — falls back to no background */ }
    })();
  }, []);

  // Default fallback: solid white -z-10 layer when no active background.
  // Guarantees the site looks like the pre-feature state regardless of
  // browser dark-mode / system bg defaults.
  if (!bg) {
    return (
      <div
        className="fixed inset-0 -z-10 bg-white pointer-events-none"
        aria-hidden="true"
      />
    );
  }

  // Cinematic dual-layer to get full viewport coverage WITHOUT the heavy
  // zoom + pixelation that plain object-cover caused for low-res sources:
  //   1. Back layer: same media, object-cover + heavy blur + slight scale
  //      → fills the entire viewport including the gutters where
  //        object-contain would otherwise leave white letterbox bars.
  //   2. Front layer: object-contain → keeps the actual subject sharp
  //      and at its native aspect ratio.
  // Net effect: edges of the screen are filled with a soft, abstract
  // version of the same image/video, and the focal content stays crisp.
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-white" aria-hidden="true">
      {bg.file_type === 'video' ? (
        <>
          <video
            src={bg.file_url}
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl"
            muted
            loop
            autoPlay
            playsInline
          />
          <video
            src={bg.file_url}
            className="relative w-full h-full object-contain"
            muted
            loop
            autoPlay
            playsInline
          />
        </>
      ) : (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bg.file_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover scale-110 blur-2xl"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={bg.file_url}
            alt=""
            className="relative w-full h-full object-contain"
          />
        </>
      )}
    </div>
  );
}
