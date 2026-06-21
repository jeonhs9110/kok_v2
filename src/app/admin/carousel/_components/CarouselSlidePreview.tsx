'use client';

import { useState } from 'react';
import { type SlideFormData } from '../_lib';
import { fontFamilyForKey, anchorToObjectPosition, anchorTextStyle } from '@/lib/typography/options';
import { SlidePreviewFullpage, SlidePreviewSplit } from './SlidePreviewLayouts';

interface Props {
  form: SlideFormData;
  /** Which language tab to show. Mirrors the editor's activeLang. */
  lang: string;
  /** Object URL for an unsaved imageFile (`URL.createObjectURL(file)`), or empty. */
  previewImageUrl: string;
  /** Object URL for the unsaved mobileImageFile (migration 35). Falls back
   *  to previewImageUrl when the admin hasn't picked a mobile-specific
   *  file/URL — matches the storefront's HeroSlider fallback. */
  previewMobileImageUrl?: string;
}

/**
 * Storefront-accurate preview of a carousel slide. Mirrors the rendering
 * in src/components/HeroSlider.tsx so admins see exactly what the slide
 * will look like before saving. Two layouts (fullpage vs split) live in
 * SlidePreviewLayouts.tsx; this file owns the chrome (PC/mobile toggle,
 * frame wrapper, aspect ratio, font + anchor derivation).
 */
export default function CarouselSlidePreview({ form, lang, previewImageUrl, previewMobileImageUrl }: Props) {
  const badge = form.badge[lang] || form.badge.kr || '';
  const title = form.title[lang] || form.title.kr || '';
  const subtitle = form.subtitle[lang] || form.subtitle.kr || '';
  const desktopMediaUrl = previewImageUrl || form.imageUrl || '';
  const mobileMediaUrl = previewMobileImageUrl || form.mobileImageUrl || desktopMediaUrl;
  const isVideo = form.media_type === 'video';
  const isFullpage = form.display_mode === 'fullpage';

  const titlePx = 48 + (form.title_size_offset || 0);
  const subtitlePx = 16 + (form.subtitle_size_offset || 0);
  const badgePx = 12 + (form.badge_size_offset || 0);

  // PC/mobile toggle just swaps which anchor key feeds the layout.
  const [view, setView] = useState<'pc' | 'mobile'>('pc');
  const isMobileView = view === 'mobile';

  // Migration 30: continuous anchors. Replaces the 9-cell positionForKey
  // lookup with (x, y) percentages the helper turns into edge-aware inline
  // styles (corner clicks pin to the corner instead of translating off-screen).
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

  // Image focal point (continuous via migration 30 anchor).
  const focalAnchor = isMobileView ? form.image_anchor_mobile : form.image_anchor;
  const focalImgStyle: React.CSSProperties = { objectPosition: anchorToObjectPosition(focalAnchor) };

  const mediaUrl = isMobileView ? mobileMediaUrl : desktopMediaUrl;
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

  const layoutProps = {
    form, badge, title, subtitle,
    badgeStyle, titleStyle, subtitleStyle, textWrapperStyle,
    badgePx, titlePx, subtitlePx, MediaEl,
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
          미리보기 ({lang.toUpperCase()})
        </label>
        <div className="inline-flex bg-[#f3f4f6] rounded p-0.5 text-[10px] font-bold">
          {(['pc', 'mobile'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => setView(v)}
              className={`px-2.5 py-1 rounded transition-colors ${
                view === v ? 'bg-white text-[#1f2937] shadow-sm' : 'text-[#6b7280] hover:text-[#1f2937]'
              }`}
            >
              {v === 'pc' ? 'PC' : '모바일'}
            </button>
          ))}
        </div>
      </div>
      {/* 16:7 for PC view (hero band); 9:14 for mobile view (phone portrait
          approximation, matching the storefront 440px @ 360 wide ratio).
          Centered + max-width on mobile keeps the preview from stretching
          the modal. */}
      <div
        className={`relative rounded-lg overflow-hidden border border-[#e5e7eb] shadow-sm mx-auto ${
          isMobileView ? 'w-[220px] aspect-[9/14]' : 'w-full aspect-[16/7]'
        }`}
        style={{ backgroundColor: form.bg_color || '#eef4f7' }}
      >
        {isFullpage ? <SlidePreviewFullpage {...layoutProps} /> : <SlidePreviewSplit {...layoutProps} />}
      </div>
      <p className="text-[10px] text-[#9ca3af] text-center">
        {isMobileView
          ? '모바일 텍스트 위치를 기준으로 표시됩니다. 폰트 크기는 시각적 비율을 위해 50%로 축소되어 있습니다.'
          : 'PC 텍스트 위치를 기준으로 표시됩니다. 폰트 크기는 시각적 비율을 위해 50%로 축소되어 있습니다.'}
      </p>
    </div>
  );
}
