'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { safeUrl } from '@/lib/url/safeUrl';

export interface PromoBanner {
  id: string;
  image_url: string;
  link_url: string;
  sort_order: number;
}

interface Props {
  banners: PromoBanner[];
  lang?: string;
}

export default function PromoBannersSection({ banners: serverBanners, lang = 'kr' }: Props) {
  const isKr = lang === 'kr';
  const altLabel = isKr ? '프로모션 배너' : 'Promotion banner';
  const emptyLabel = isKr ? '배너 이미지 없음' : 'No banner image';
  // Live preview overlay — /admin/promo-banners broadcasts the full
  // in-flight banners array. Each broadcast replaces the rendered set
  // wholesale so image uploads, link edits, and active toggles all
  // appear in the central iframe before save. Null payload (drawer
  // close) drops back to the persisted rows.
  const [override, setOverride] = useState<PromoBanner[] | null>(null);
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type !== 'kokkok-builder-promo-preview') return;
      setOverride(Array.isArray(e.data.banners) ? e.data.banners : null);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);
  const banners = override ?? serverBanners;
  if (!banners || banners.length === 0) return null;

  // Show at most 2 banners
  const display = banners.slice(0, 2);

  return (
    <section className="py-8 md:py-12">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 md:gap-5">
          {display.map((banner) => {
            const href = safeUrl(banner.link_url);
            const isExternal = /^https?:\/\//i.test(href);
            return (
            <Link
              key={banner.id}
              href={href}
              target={isExternal ? '_blank' : undefined}
              rel={isExternal ? 'noopener noreferrer' : undefined}
              className="relative block aspect-square overflow-hidden rounded-xl group isolate"
            >
              {banner.image_url ? (
                // next/image transcodes the operator's PNG/JPEG to AVIF
                // /WebP at the SAME source resolution. Just-in-time format
                // change — no quality loss, ~60-80% smaller bytes.
                <Image
                  src={banner.image_url}
                  alt={altLabel}
                  width={800}
                  height={800}
                  sizes="(min-width: 1024px) 600px, 50vw"
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-400 text-sm">
                  {emptyLabel}
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
            </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
