'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { HomepageBanner } from '@/lib/api/homepageBanners';
import type { Lang } from '@/lib/i18n/types';
import { safeUrl } from '@/lib/url/safeUrl';

interface Props {
  banner: HomepageBanner;
  lang: Lang;
}

/**
 * HomepageBanner — inline single-line strip rendered BETWEEN homepage
 * sections. Operator can spawn N of these from the builder and drag
 * each into any position in the section order (above carousel, between
 * sections, right before Instagram, wherever). Hidden when inactive or
 * empty for the current language.
 *
 * Mirrors TopStripeBanner's look (bg/text colors + center text) but
 * lives inside the homepage flow rather than above the global header.
 */
export default function HomepageBanner({ banner: serverBanner, lang }: Props) {
  // Live preview overlay — /admin/banners/[id] broadcasts the in-flight
  // form values when the operator opens the drawer; we only apply the
  // override if the bannerId matches this row's id, so editing one
  // banner doesn't disturb the others currently rendered.
  const [override, setOverride] = useState<Partial<HomepageBanner> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'kokkok-builder-banner-preview') return;
      if (e.data.bannerId !== serverBanner.id) return;
      setOverride(e.data.override ?? null);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [serverBanner.id]);
  const banner = override ? { ...serverBanner, ...override } : serverBanner;
  if (!banner.is_active) return null;
  const text = banner.text?.[lang] || banner.text?.kr || banner.text?.en || '';
  if (!text) return null;
  const style: React.CSSProperties = {
    backgroundColor: banner.bg_color || '#1f2937',
    color: banner.text_color || '#ffffff',
  };
  const inner = (
    <div
      className="text-center py-3 px-4 text-[13px] sm:text-[14px] font-medium tracking-wide"
      style={style}
    >
      {text}
    </div>
  );
  if (banner.link_url) {
    // External URLs use a plain anchor so Next.js doesn't try to
    // prefetch the foreign origin or treat it as an internal route.
    // Internal paths get the prefetched <Link>.
    // safeUrl() collapses javascript: / data: / vbscript: to '#' before
    // it can land in an href — protects against an admin typo or
    // compromised admin account dropping a malicious URL into the
    // banner row.
    const safe = safeUrl(banner.link_url);
    if (safe === '#') return inner;
    const isExternal = /^https?:\/\//i.test(safe);
    if (isExternal) {
      return (
        <a
          href={safe}
          target="_blank"
          rel="noopener noreferrer"
          className="block hover:opacity-90 transition-opacity"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link href={safe} className="block hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}
