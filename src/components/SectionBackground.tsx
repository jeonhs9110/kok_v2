import type { ReactNode, CSSProperties } from 'react';

/**
 * Public-side renderer for the admin-configured section background.
 * Used by ShortsFeed and InstagramSection (migration 26 added the
 * columns to shorts_config / instagram_config).
 *
 * Shape mirrors what SectionBackgroundPanel writes:
 *   type 'transparent' / null   → no inline bg, no media layer
 *   type 'color'                → inline backgroundColor
 *   type 'image' | 'video'      → <img>/<video> stretched behind content
 *
 * The wrapper itself owns `position: relative` and `overflow-hidden`
 * so the absolute media layer never escapes the section. Content
 * children are stacked above with z-10. The caller still controls
 * outer spacing / vertical padding via its own className.
 */

export interface SectionBackgroundConfig {
  type?: string | null;
  color?: string | null;
  media_url?: string | null;
  media_type?: string | null;
}

interface Props {
  config: SectionBackgroundConfig | null | undefined;
  /** Additional classes for the outer section (e.g. py-16, text color). */
  className?: string;
  /** Fallback Tailwind classes when admin hasn't configured a bg yet. */
  fallbackClassName?: string;
  children: ReactNode;
}

export default function SectionBackground({
  config,
  className = '',
  fallbackClassName = '',
  children,
}: Props) {
  const type = config?.type ?? null;
  const isMedia = type === 'image' || type === 'video';

  // Pre-configured fallback (legacy behavior) when nothing's set.
  if (type === null) {
    return <section className={`relative ${fallbackClassName} ${className}`}>{children}</section>;
  }

  // Deliberate transparent — strip any inherited bg classes from the caller.
  if (type === 'transparent') {
    return <section className={`relative ${className}`}>{children}</section>;
  }

  // Solid color.
  if (type === 'color') {
    const style: CSSProperties = { backgroundColor: config?.color ?? '#111111' };
    return (
      <section className={`relative ${className}`} style={style}>
        {children}
      </section>
    );
  }

  // Image or video — render media absolutely behind content.
  if (isMedia && config?.media_url) {
    return (
      <section className={`relative overflow-hidden ${className}`}>
        <div className="absolute inset-0 z-0">
          {config.media_type === 'video' ? (
            <video
              src={config.media_url}
              autoPlay muted loop playsInline
              className="w-full h-full object-cover"
            />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={config.media_url}
              alt=""
              className="w-full h-full object-cover"
              loading="lazy"
            />
          )}
        </div>
        <div className="relative z-10">{children}</div>
      </section>
    );
  }

  // Media type set but no URL yet — fall back to the legacy look.
  return <section className={`relative ${fallbackClassName} ${className}`}>{children}</section>;
}
