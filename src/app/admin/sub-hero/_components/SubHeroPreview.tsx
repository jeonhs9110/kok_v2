'use client';

import { fontFamilyForKey, anchorTextStyle } from '@/lib/typography/options';
import type { SubHero } from './types';

/**
 * Live preview block for the sub-hero editor. Mirrors the storefront's
 * <SubHeroBanner /> layout so the operator can adjust title/subtitle/
 * anchors and see the result without save → refresh. Font sizes are
 * halved to fit inside the editor card while still proportional.
 *
 * Extracted from /admin/sub-hero/page.tsx at 2026-06-21.
 */

interface Props {
  banner: SubHero;
  previewView: 'pc' | 'mobile';
  onChangeView: (v: 'pc' | 'mobile') => void;
}

export default function SubHeroPreview({ banner, previewView, onChangeView }: Props) {
  const anchor = previewView === 'mobile' ? banner.text_anchor_mobile : banner.text_anchor;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
          미리보기
        </label>
        <div className="inline-flex bg-[#f3f4f6] rounded p-0.5 text-[10px] font-bold">
          {(['pc', 'mobile'] as const).map(v => (
            <button
              key={v}
              type="button"
              onClick={() => onChangeView(v)}
              className={`px-2.5 py-1 rounded transition-colors ${
                previewView === v
                  ? 'bg-white text-[#1f2937] shadow-sm'
                  : 'text-[#6b7280] hover:text-[#1f2937]'
              }`}
            >
              {v === 'pc' ? 'PC' : '모바일'}
            </button>
          ))}
        </div>
      </div>
      <div
        className={`relative rounded overflow-hidden border border-[#e5e7eb] shadow-sm bg-[#f3f4f6] mx-auto ${
          previewView === 'mobile' ? 'w-[220px] aspect-[9/14]' : 'w-full aspect-[21/9]'
        }`}
      >
        {banner.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={banner.image_url}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[10px] text-[#9ca3af] tracking-widest uppercase">
            이미지를 업로드하면 미리보기가 표시됩니다
          </div>
        )}
        {(banner.title || banner.subtitle) && (
          <div className="absolute inset-0 px-6">
            <div style={anchorTextStyle(anchor)}>
              {banner.title && (
                <h3
                  className="drop-shadow-lg whitespace-pre-line mb-1"
                  style={{
                    fontSize: `${Math.max(14, (32 + (banner.title_size_offset || 0)) * 0.5)}px`,
                    fontFamily: fontFamilyForKey(banner.title_font_family),
                    fontWeight: banner.title_bold ? 800 : 400,
                    fontStyle: banner.title_italic ? 'italic' : 'normal',
                    textDecoration: banner.title_underline ? 'underline' : 'none',
                    color: banner.title_color ?? '#ffffff',
                  }}
                >
                  {banner.title}
                </h3>
              )}
              {banner.subtitle && (
                <p
                  className="drop-shadow-md"
                  style={{
                    fontSize: `${Math.max(10, (16 + (banner.subtitle_size_offset || 0)) * 0.5)}px`,
                    fontFamily: fontFamilyForKey(banner.subtitle_font_family),
                    fontWeight: banner.subtitle_bold ? 700 : 400,
                    fontStyle: banner.subtitle_italic ? 'italic' : 'normal',
                    textDecoration: banner.subtitle_underline ? 'underline' : 'none',
                    color: banner.subtitle_color ?? 'rgba(255,255,255,0.9)',
                  }}
                >
                  {banner.subtitle}
                </p>
              )}
            </div>
          </div>
        )}
        {banner.link_url && (
          <span className="absolute bottom-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-white">
            → {banner.link_url}
          </span>
        )}
      </div>
    </div>
  );
}
