'use client';

import type { SlideFormData } from '../_lib';

interface CommonProps {
  form: SlideFormData;
  badge: string;
  title: string;
  subtitle: string;
  badgeStyle: React.CSSProperties;
  titleStyle: React.CSSProperties;
  subtitleStyle: React.CSSProperties;
  textWrapperStyle: React.CSSProperties;
  badgePx: number;
  titlePx: number;
  subtitlePx: number;
  MediaEl: React.ReactNode;
}

/**
 * Fullpage layout: media fills the slide, text overlays on top with
 * drop-shadows. Used when display_mode === 'fullpage'.
 */
export function SlidePreviewFullpage(p: CommonProps) {
  return (
    <>
      <div className="absolute inset-0">{p.MediaEl}</div>
      {(p.badge || p.title || p.subtitle) && (
        <div style={p.textWrapperStyle}>
          <div>
            {p.badge && (
              <span
                className="inline-block px-2 py-1 rounded-full mb-2 backdrop-blur-sm"
                style={{
                  ...p.badgeStyle,
                  backgroundColor: p.form.badge_bg_color || 'rgba(0,0,0,0.7)',
                  color: p.form.badge_text_color || '#fff',
                  fontSize: `${Math.max(8, p.badgePx * 0.5)}px`,
                }}
              >
                {p.badge}
              </span>
            )}
            {p.title && (
              <h2
                className="whitespace-pre-line drop-shadow-lg mb-1"
                style={{
                  ...p.titleStyle,
                  color: p.form.text_color || '#fff',
                  fontSize: `${Math.max(14, p.titlePx * 0.5)}px`,
                  lineHeight: 1.2,
                }}
              >
                {p.title}
              </h2>
            )}
            {p.subtitle && (
              <p
                className="drop-shadow-md"
                style={{
                  ...p.subtitleStyle,
                  color: p.form.text_color || 'rgba(255,255,255,0.9)',
                  fontSize: `${Math.max(10, p.subtitlePx * 0.5)}px`,
                }}
              >
                {p.subtitle}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Split layout: 50/50 text on left, media on right with aspect-[5/6]
 * shadowed frame. Default display mode.
 */
export function SlidePreviewSplit(p: CommonProps) {
  return (
    <div className="absolute inset-0 grid grid-cols-2">
      {/* Text side — anchor pins the block within the left half via the
          same edge-aware inline styles as fullpage mode. */}
      <div className="relative px-6 py-4">
        <div style={p.textWrapperStyle}>
          {p.badge && (
            <span
              className="inline-block w-fit px-2 py-1 rounded-full mb-2"
              style={{
                ...p.badgeStyle,
                backgroundColor: p.form.badge_bg_color || '#333',
                color: p.form.badge_text_color || '#fff',
                fontSize: `${Math.max(8, p.badgePx * 0.5)}px`,
              }}
            >
              {p.badge}
            </span>
          )}
          {p.title && (
            <h2
              className="whitespace-pre-line mb-1"
              style={{
                ...p.titleStyle,
                color: p.form.text_color || '#111',
                fontSize: `${Math.max(14, p.titlePx * 0.5)}px`,
                lineHeight: 1.15,
              }}
            >
              {p.title}
            </h2>
          )}
          {p.subtitle && (
            <p style={{
              ...p.subtitleStyle,
              color: p.form.text_color || '#111',
              fontSize: `${Math.max(10, p.subtitlePx * 0.5)}px`,
            }}>
              {p.subtitle}
            </p>
          )}
        </div>
      </div>
      {/* Media side */}
      <div className="p-4 flex items-center justify-end">
        <div className="relative h-[85%] aspect-[5/6] shadow-lg rounded-md overflow-hidden">
          {p.MediaEl}
        </div>
      </div>
    </div>
  );
}
