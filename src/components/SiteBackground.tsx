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

  // object-contain (not object-cover) so the media fits inside the viewport
  // without cropping or upscaling beyond its native size — avoids the heavy
  // zoom + visible pixelation that object-cover caused for lower-resolution
  // assets. bg-white on the wrapper fills any letterbox area left by
  // aspect-ratio mismatch with the same default look as the fallback.
  return (
    <div className="fixed inset-0 -z-10 pointer-events-none overflow-hidden bg-white" aria-hidden="true">
      {bg.file_type === 'video' ? (
        <video
          src={bg.file_url}
          className="w-full h-full object-contain"
          muted
          loop
          autoPlay
          playsInline
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={bg.file_url} alt="" className="w-full h-full object-contain" />
      )}
    </div>
  );
}
