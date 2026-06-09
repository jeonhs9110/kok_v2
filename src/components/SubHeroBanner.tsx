import Link from 'next/link';
import { fontFamilyForKey, anchorTextStyle, anchorToObjectPosition, resolveAnchor, type PositionKey } from '@/lib/typography/options';

export interface SubHeroBannerData {
  id: string;
  image_url: string;
  link_url: string;
  title: string;
  subtitle: string;
  title_size_offset?: number | null;
  subtitle_size_offset?: number | null;
  // Phase 2 typography columns. All optional so the storefront keeps
  // rendering correctly for rows from before the migration ran — each
  // resolver falls back to the previous hardcoded look.
  title_font_family?: string | null;
  subtitle_font_family?: string | null;
  title_bold?: boolean | null;
  title_italic?: boolean | null;
  title_underline?: boolean | null;
  subtitle_bold?: boolean | null;
  subtitle_italic?: boolean | null;
  subtitle_underline?: boolean | null;
  title_color?: string | null;
  subtitle_color?: string | null;
  text_position?: PositionKey | string | null;
  // Migration 30: continuous (x, y) anchors. Read first; legacy
  // text_position is the fallback for pre-migration rows.
  text_anchor?: unknown;
  text_anchor_mobile?: unknown;
  // Migration 31: image focal point per breakpoint, same shape as
  // the carousel's. NULL on rows saved before the picker shipped;
  // resolveAnchor's center default keeps them readable.
  image_anchor?: unknown;
  image_anchor_mobile?: unknown;
  // Migration 28: separate mobile anchor.
  text_position_mobile?: PositionKey | string | null;
}

interface Props {
  banner: SubHeroBannerData | null;
}

export default function SubHeroBanner({ banner }: Props) {
  if (!banner) return null;

  const titleOffset = banner.title_size_offset ?? 0;
  const subtitleOffset = banner.subtitle_size_offset ?? 0;

  const inner = (
    <div className="relative w-full h-[360px] md:h-[560px] overflow-hidden group">
      {banner.image_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={banner.image_url}
          alt={banner.title || ''}
          width={1600}
          height={560}
          loading="lazy"
          /* Image focal point — same approach as HeroSlider:
             CSS vars set inline on the element are consumed by the
             sub-hero-image-focal class via a 768px media query in
             globals.css. NULL anchors fall through to center via
             resolveAnchor. */
          className="w-full h-full object-cover sub-hero-image-focal transition-transform duration-700 group-hover:scale-[1.03]"
          style={{
            ['--img-pos-mobile' as string]: anchorToObjectPosition(
              resolveAnchor(banner.image_anchor_mobile, null),
            ),
            ['--img-pos-desktop' as string]: anchorToObjectPosition(
              resolveAnchor(banner.image_anchor, null),
            ),
          } as React.CSSProperties}
        />
      ) : (
        <div className="w-full h-full bg-neutral-200" />
      )}

      {/* Gradient overlay — darker under text region so bright background
          images don't wash out the title/subtitle */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/30 to-transparent" />

      {/* Text */}
      {(banner.title || banner.subtitle) && (() => {
        // Resolve admin choices into Tailwind utilities + inline style.
        // Each helper has a sensible fallback so a freshly-migrated row
        // (all-NULL columns) renders the same as the pre-Phase-2 layout.
        //
        // Migration 30: continuous (x, y) anchors with legacy 9-cell
        // fallback. Per-breakpoint placement is achieved by rendering
        // two text overlays — sm:hidden mobile + hidden sm:block
        // desktop — each carrying its own anchorTextStyle inline.
        const anchorMobile  = resolveAnchor(banner.text_anchor_mobile, banner.text_position_mobile);
        const anchorDesktop = resolveAnchor(banner.text_anchor, banner.text_position);
        const titleStyle: React.CSSProperties = {
          fontFamily: fontFamilyForKey(banner.title_font_family),
          fontWeight: banner.title_bold === false ? 400 : 900,
          fontStyle: banner.title_italic ? 'italic' : 'normal',
          textDecoration: banner.title_underline ? 'underline' : 'none',
          color: banner.title_color ?? undefined,
          ...(titleOffset !== 0 && { ['--title-fs' as string]: `calc(3rem + ${titleOffset}px)` }),
        };
        const subtitleStyle: React.CSSProperties = {
          fontFamily: fontFamilyForKey(banner.subtitle_font_family),
          fontWeight: banner.subtitle_bold ? 700 : 500,
          fontStyle: banner.subtitle_italic ? 'italic' : 'normal',
          textDecoration: banner.subtitle_underline ? 'underline' : 'none',
          color: banner.subtitle_color ?? undefined,
          ...(subtitleOffset !== 0 && { ['--subtitle-fs' as string]: `calc(1rem + ${subtitleOffset}px)` }),
        };
        const TextContent = (
          <>
            {banner.subtitle && (
              <p
                className={`text-sm md:text-base font-medium tracking-widest uppercase mb-3 opacity-80 max-w-full [word-break:keep-all] [overflow-wrap:break-word] ${subtitleOffset !== 0 ? 'md:text-[length:var(--subtitle-fs)]' : ''}`}
                style={subtitleStyle}
              >
                {banner.subtitle}
              </p>
            )}
            {banner.title && (
              <h2
                className={`text-3xl md:text-5xl tracking-tight leading-tight max-w-2xl [word-break:keep-all] [overflow-wrap:break-word] ${titleOffset !== 0 ? 'md:text-[length:var(--title-fs)]' : ''}`}
                style={titleStyle}
              >
                {banner.title}
              </h2>
            )}
          </>
        );
        return (
          <div className="absolute inset-0 px-6 text-white pointer-events-none">
            <div className="md:hidden h-full w-full relative">
              <div style={anchorTextStyle(anchorMobile)}>{TextContent}</div>
            </div>
            <div className="hidden md:block h-full w-full relative">
              <div style={anchorTextStyle(anchorDesktop)}>{TextContent}</div>
            </div>
          </div>
        );
      })()}
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
