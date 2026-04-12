'use client';

import Link from 'next/link';

export interface SubHeroBannerData {
  id: string;
  image_url: string;
  link_url: string;
  title: string;
  subtitle: string;
}

interface Props {
  banner: SubHeroBannerData | null;
}

export default function SubHeroBanner({ banner }: Props) {
  if (!banner) return null;

  const inner = (
    <div className="relative w-full h-[420px] md:h-[560px] overflow-hidden group">
      {banner.image_url ? (
        <img
          src={banner.image_url}
          alt={banner.title || ''}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-[1.03]"
        />
      ) : (
        <div className="w-full h-full bg-neutral-200" />
      )}

      {/* Dark overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Text */}
      {(banner.title || banner.subtitle) && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white text-center px-6">
          {banner.subtitle && (
            <p className="text-sm md:text-base font-medium tracking-widest uppercase mb-3 opacity-80">
              {banner.subtitle}
            </p>
          )}
          {banner.title && (
            <h2 className="text-3xl md:text-5xl font-black tracking-tight leading-tight max-w-2xl">
              {banner.title}
            </h2>
          )}
        </div>
      )}
    </div>
  );

  if (banner.link_url && banner.link_url !== '#') {
    return (
      <section>
        <Link
          href={banner.link_url}
          target={banner.link_url.startsWith('http') ? '_blank' : undefined}
          rel={banner.link_url.startsWith('http') ? 'noopener noreferrer' : undefined}
        >
          {inner}
        </Link>
      </section>
    );
  }

  return <section>{inner}</section>;
}
