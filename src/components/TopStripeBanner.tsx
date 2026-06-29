'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { safeUrl } from '@/lib/url/safeUrl';

export interface TopStripeBannerData {
  is_active: boolean;
  text: string;
  link_url: string;
  bg_color: string;
  text_color: string;
}

interface Props {
  data: TopStripeBannerData | null;
}

/**
 * TopStripeBanner — a thin promotional band rendered above the header
 * on every page. Hidden when inactive or empty. Operator's 2026-06-17
 * ask after pointing at Cafe24's equivalent ("첫 쇼핑을 지원하는…"
 * coupon stripe).
 *
 * If link_url is set, the whole stripe becomes a clickable Link;
 * otherwise it renders as a div.
 *
 * Live preview overlay — /admin/top-stripe broadcasts in-flight values
 * via `kokkok-builder-topstripe-preview` so the central iframe in the
 * homepage builder reflects edits before save. No-op for customers.
 */
export default function TopStripeBanner({ data: serverData }: Props) {
  const [override, setOverride] = useState<Partial<TopStripeBannerData> | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'kokkok-builder-topstripe-preview') return;
      setOverride(e.data.override ?? null);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const data: TopStripeBannerData | null = serverData
    ? (override ? { ...serverData, ...override } : serverData)
    : null;
  if (!data || !data.is_active || !data.text) return null;
  const style: React.CSSProperties = {
    backgroundColor: data.bg_color || '#1f2937',
    color: data.text_color || '#ffffff',
  };
  const inner = (
    <div
      className="text-center py-2 px-4 text-[12px] sm:text-[13px] font-medium tracking-wide"
      style={style}
    >
      {data.text}
    </div>
  );
  const safeHref = safeUrl(data.link_url);
  if (safeHref !== '#') {
    return <Link href={safeHref} className="block hover:opacity-90 transition-opacity">{inner}</Link>;
  }
  return inner;
}
