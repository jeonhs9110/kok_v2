import Link from 'next/link';
import type { HomepageBanner } from '@/lib/api/homepageBanners';
import type { Lang } from '@/lib/i18n/types';

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
export default function HomepageBanner({ banner, lang }: Props) {
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
    const isExternal = /^https?:\/\//i.test(banner.link_url);
    if (isExternal) {
      return (
        <a
          href={banner.link_url}
          target="_blank"
          rel="noopener noreferrer"
          className="block hover:opacity-90 transition-opacity"
        >
          {inner}
        </a>
      );
    }
    return (
      <Link href={banner.link_url} className="block hover:opacity-90 transition-opacity">
        {inner}
      </Link>
    );
  }
  return inner;
}
