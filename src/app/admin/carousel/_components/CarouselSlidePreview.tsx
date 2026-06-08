'use client';

import { useState } from 'react';
import { type SlideFormData } from '../_lib';
import { fontFamilyForKey, anchorToObjectPosition, anchorTextStyle } from '@/lib/typography/options';

interface Props {
  form: SlideFormData;
  /** Which language tab to show in the preview. Mirrors the editor's activeLang. */
  lang: string;
  /** Object URL for an unsaved imageFile (`URL.createObjectURL(file)`), or empty. */
  previewImageUrl: string;
}

/**
 * Storefront-accurate preview of a carousel slide. Mirrors the rendering
 * in src/components/HeroSlider.tsx so admins see exactly what the slide
 * will look like before saving — the previous workflow was save → open
 * /kr in another tab → realize text was the wrong color → repeat.
 *
 * Kept in /admin/carousel/_components/ (not /components/) so it can
 * import the editor's form type without dragging the editor schema
 * into the public chrome.
 */
export default function CarouselSlidePreview({ form, lang, previewImageUrl }: Props) {
  const badge = form.badge[lang] || form.badge.kr || '';
  const title = form.title[lang] || form.title.kr || '';
  const subtitle = form.subtitle[lang] || form.subtitle.kr || '';
  const mediaUrl = previewImageUrl || form.imageUrl || '';
  const isVideo = form.media_type === 'video';
  const isFullpage = form.display_mode === 'fullpage';

  const titlePx = 48 + (form.title_size_offset || 0);
  const subtitlePx = 16 + (form.subtitle_size_offset || 0);
  const badgePx = 12 + (form.badge_size_offset || 0);

  // Preview-only toggle so the admin can see how the slide looks at
  // each breakpoint without leaving the modal. The picker just swaps
  // which position key feeds the layout — same render, different anchor.
  const [view, setView] = useState<'pc' | 'mobile'>('pc');
  const isMobileView = view === 'mobile';

  // Migration 30: continuous anchors. Replaces the 9-cell positionForKey
  // lookup with a (x, y) percentage that the helper turns into inline
  // styles (edge-aware so corner clicks pin to the corner instead of
  // translating off-screen).
  const textAnchor = isMobileView ? form.text_anchor_mobile : form.text_anchor;
  const textWrapperStyle = anchorTextStyle(textAnchor);
  const badgeStyle: React.CSSProperties = {
    fontFamily: fontFamilyForKey(form.badge_font_family),
    fontWeight: form.badge_bold ? 700 : 500,
    fontStyle: form.badge_italic ? 'italic' : 'normal',
    textDecoration: form.badge_underline ? 'underline' : 'none',
  };
  const titleStyle: React.CSSProperties = {
    fontFamily: fontFamilyForKey(form.title_font_family),
    fontWeight: form.title_bold ? 800 : 400,
    fontStyle: form.title_italic ? 'italic' : 'normal',
    textDecoration: form.title_underline ? 'underline' : 'none',
  };
  const subtitleStyle: React.CSSProperties = {
    fontFamily: fontFamilyForKey(form.subtitle_font_family),
    fontWeight: form.subtitle_bold ? 700 : 400,
    fontStyle: form.subtitle_italic ? 'italic' : 'normal',
    textDecoration: form.subtitle_underline ? 'underline' : 'none',
  };

  // Image focal point (now continuous via migration 30 anchor).
  const focalAnchor = isMobileView ? form.image_anchor_mobile : form.image_anchor;
  const focalImgStyle: React.CSSProperties = { objectPosition: anchorToObjectPosition(focalAnchor) };

  const MediaEl = mediaUrl ? (
    isVideo ? (
      <video src={mediaUrl} autoPlay muted loop playsInline className="w-full h-full object-cover" style={focalImgStyle} />
    ) : (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={mediaUrl} alt="" className="w-full h-full object-cover" style={focalImgStyle} />
    )
  ) : (
    <div className="w-full h-full bg-gradient-to-br from-neutral-100 to-neutral-200 flex items-center justify-center">
      <span className="text-[10px] font-bold tracking-widest uppercase text-neutral-400">No media</span>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
          미리보기 ({lang.toUpperCase()})
        </label>
        <div className="inline-flex bg-gray-100 rounded p-0.5 text-[10px] font-bold">
          {(['pc', 'mobile'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded transition-colors ${
                view === v ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'
              }`}
            >
              {v === 'pc' ? 'PC' : '모바일'}
            </button>
          ))}
        </div>
      </div>
      {/* 16:7 for PC view (hero band); 9:14 for mobile view (phone
          portrait approximation, matching the storefront 440px @ 360 wide
          ratio). Centered + max-width on mobile keeps the preview from
          stretching the modal. */}
      <div
        className={`relative rounded-lg overflow-hidden border border-gray-200 shadow-sm mx-auto ${
          isMobileView ? 'w-[220px] aspect-[9/14]' : 'w-full aspect-[16/7]'
        }`}
        style={{ backgroundColor: form.bg_color || '#eef4f7' }}
      >
        {isFullpage ? (
          <>
            <div className="absolute inset-0">{MediaEl}</div>
            {(badge || title || subtitle) && (
              <div style={textWrapperStyle}>
                <div>
                  {badge && (
                    <span
                      className="inline-block px-2 py-1 rounded-full mb-2 backdrop-blur-sm"
                      style={{
                        ...badgeStyle,
                        backgroundColor: form.badge_bg_color || 'rgba(0,0,0,0.7)',
                        color: form.badge_text_color || '#fff',
                        fontSize: `${Math.max(8, badgePx * 0.5)}px`,
                      }}
                    >
                      {badge}
                    </span>
                  )}
                  {title && (
                    <h2
                      className="whitespace-pre-line drop-shadow-lg mb-1"
                      style={{
                        ...titleStyle,
                        color: form.text_color || '#fff',
                        fontSize: `${Math.max(14, titlePx * 0.5)}px`,
                        lineHeight: 1.2,
                      }}
                    >
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p
                      className="drop-shadow-md"
                      style={{
                        ...subtitleStyle,
                        color: form.text_color || 'rgba(255,255,255,0.9)',
                        fontSize: `${Math.max(10, subtitlePx * 0.5)}px`,
                      }}
                    >
                      {subtitle}
                    </p>
                  )}
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="absolute inset-0 grid grid-cols-2">
            {/* Text side — anchor pins the block within the left half
                via the same edge-aware inline styles as fullpage mode. */}
            <div className="relative px-6 py-4">
              <div style={textWrapperStyle}>
              {badge && (
                <span
                  className="inline-block w-fit px-2 py-1 rounded-full mb-2"
                  style={{
                    ...badgeStyle,
                    backgroundColor: form.badge_bg_color || '#333',
                    color: form.badge_text_color || '#fff',
                    fontSize: `${Math.max(8, badgePx * 0.5)}px`,
                  }}
                >
                  {badge}
                </span>
              )}
              {title && (
                <h2
                  className="whitespace-pre-line mb-1"
                  style={{
                    ...titleStyle,
                    color: form.text_color || '#111',
                    fontSize: `${Math.max(14, titlePx * 0.5)}px`,
                    lineHeight: 1.15,
                  }}
                >
                  {title}
                </h2>
              )}
              {subtitle && (
                <p style={{
                  ...subtitleStyle,
                  color: form.text_color || '#111',
                  fontSize: `${Math.max(10, subtitlePx * 0.5)}px`,
                }}>
                  {subtitle}
                </p>
              )}
              </div>
            </div>
            {/* Media side */}
            <div className="p-4 flex items-center justify-end">
              <div className="relative h-[85%] aspect-[5/6] shadow-lg rounded-md overflow-hidden">
                {MediaEl}
              </div>
            </div>
          </div>
        )}
      </div>
      <p className="text-[10px] text-gray-400 text-center">
        {isMobileView
          ? '모바일 텍스트 위치를 기준으로 표시됩니다. 폰트 크기는 시각적 비율을 위해 50%로 축소되어 있습니다.'
          : 'PC 텍스트 위치를 기준으로 표시됩니다. 폰트 크기는 시각적 비율을 위해 50%로 축소되어 있습니다.'}
      </p>
    </div>
  );
}
