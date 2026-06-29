'use client';

import { useEffect, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import type { Lang } from '@/lib/i18n/types';

interface Props {
  lang: Lang;
  initialTitle: string;
  initialSubtitle: string;
}

interface Override {
  is_active?: boolean;
  title_kr?: string;
  title_en?: string;
  subtitle_kr?: string;
  subtitle_en?: string;
}

/**
 * Client-side header for the top-viewed section. Renders the title +
 * subtitle from server-provided initial values, but listens for the
 * `kokkok-builder-topviewed-preview` message so /admin/top-viewed edits
 * to those fields reflect in the central iframe in real time.
 *
 * `window.parent === window` short-circuit keeps the listener a no-op
 * for normal customer traffic.
 */
export default function TopViewedHeader({ lang, initialTitle, initialSubtitle }: Props) {
  const [override, setOverride] = useState<Override | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'kokkok-builder-topviewed-preview') return;
      setOverride(e.data.override ?? null);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const title =
    (lang === 'kr' ? override?.title_kr : override?.title_en) ?? initialTitle;
  const subtitle =
    (lang === 'kr' ? override?.subtitle_kr : override?.subtitle_en) ?? initialSubtitle;

  return (
    <div className="max-w-[1240px] mx-auto px-4 sm:px-6 pt-16 md:pt-24 flex flex-col items-center text-center">
      <div className="inline-flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-brand-accent uppercase mb-2">
        <TrendingUp className="w-3.5 h-3.5" />
        {subtitle}
      </div>
      <h2 className="kokkok-product-section-title font-extrabold text-brand-ink">
        {title}
      </h2>
    </div>
  );
}
