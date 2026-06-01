'use client';

import { type SlideFormData } from '../_lib';
import { fontFamilyForKey, positionForKey } from '@/lib/typography/options';

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

  // Phase 3 typography resolvers — surfaced once so we don't repeat the
  // ternaries inside the JSX for both render modes.
  const pos = positionForKey(form.text_position);
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

  const MediaEl = mediaUrl ? (
    isVideo ? (
      <video src={mediaUrl} autoPlay muted loop playsInline className="w-full h-full object-cover object-center" />
    ) : (
      /* eslint-disable-next-line @next/next/no-img-element */
      <img src={mediaUrl} alt="" className="w-full h-full object-cover object-center" />
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
        <span className="text-[10px] text-gray-400">실제 화면 비율 축소판</span>
      </div>
      {/* 16:9 aspect to approximate the desktop hero band */}
      <div
        className="relative w-full aspect-[16/7] rounded-lg overflow-hidden border border-gray-200 shadow-sm"
        style={{ backgroundColor: form.bg_color || '#eef4f7' }}
      >
        {isFullpage ? (
          <>
            <div className="absolute inset-0">{MediaEl}</div>
            {(badge || title || subtitle) && (
              <div className={`absolute inset-0 flex flex-col px-6 ${pos.align} ${pos.justify} ${pos.textAlign}`}>
                <div className="max-w-lg">
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
            {/* Text side — position picker drives where the block sits
                within the left half. */}
            <div className={`flex flex-col px-6 py-4 ${pos.align} ${pos.justify} ${pos.textAlign}`}>
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
        텍스트 / 색상 / 이미지가 바로 반영됩니다. 폰트 크기는 시각적 비율을 위해 50%로 축소되어 표시됩니다.
      </p>
    </div>
  );
}
