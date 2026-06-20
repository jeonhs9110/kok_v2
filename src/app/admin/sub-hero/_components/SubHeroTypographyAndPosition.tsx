'use client';

import { TypographyPanel } from '@/components/admin/TypographyPanel';
import ContinuousPositionPicker from '@/components/admin/ContinuousPositionPicker';
import type { SubHero } from './types';

/**
 * Phase 2 typography + position controls for the sub-hero editor. Two
 * TypographyPanels (title / subtitle) + the dual text anchor pickers +
 * the dual image focal point pickers, all stacked. Same shape as the
 * carousel modal's SlideTypographyAndPosition but tuned for the 2-
 * field sub-hero (no badge row).
 *
 * Extracted from /admin/sub-hero/page.tsx at 2026-06-21.
 */

interface Props {
  banner: SubHero;
  onChange: (patch: Partial<SubHero>) => void;
}

export default function SubHeroTypographyAndPosition({ banner, onChange }: Props) {
  const positionBackground = banner.image_url || undefined;

  return (
    <div className="space-y-4 pt-2 border-t border-[#f3f4f6]">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
          타이포그래피
        </p>
        <p className="text-[10px] text-[#9ca3af] mt-0.5">
          폰트 / 굵기 / 기울임 / 밑줄 / 색상을 텍스트별로 지정하고, 텍스트 블록의 위치를 이미지
          안에서 골라보세요.
        </p>
      </div>
      <TypographyPanel
        label="제목 스타일"
        value={{
          fontFamily: banner.title_font_family,
          bold: banner.title_bold,
          italic: banner.title_italic,
          underline: banner.title_underline,
          color: banner.title_color,
        }}
        onChange={s =>
          onChange({
            title_font_family: s.fontFamily,
            title_bold: s.bold,
            title_italic: s.italic,
            title_underline: s.underline,
            title_color: s.color,
          })
        }
        defaultColor="#ffffff"
      />
      <TypographyPanel
        label="서브타이틀 스타일"
        value={{
          fontFamily: banner.subtitle_font_family,
          bold: banner.subtitle_bold,
          italic: banner.subtitle_italic,
          underline: banner.subtitle_underline,
          color: banner.subtitle_color,
        }}
        onChange={s =>
          onChange({
            subtitle_font_family: s.fontFamily,
            subtitle_bold: s.bold,
            subtitle_italic: s.italic,
            subtitle_underline: s.underline,
            subtitle_color: s.color,
          })
        }
        defaultColor="#ffffff"
      />

      {/* Dual anchor: text can be placed differently on desktop vs mobile
          (migration 28). Mirrors the carousel modal pattern from PR #89
          so the admin gets consistent controls across both editors. */}
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase mb-1">
          텍스트 위치
        </p>
        <p className="text-[10px] text-[#9ca3af] mb-2">
          미리보기에서 원하는 위치를 클릭하거나 흰 점을 드래그하세요. (PC와 모바일을 따로 설정)
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ContinuousPositionPicker
            label="PC 텍스트 위치"
            value={banner.text_anchor}
            onChange={a => onChange({ text_anchor: a })}
            aspectRatio="aspect-[16/7]"
            backgroundImage={positionBackground}
          />
          <ContinuousPositionPicker
            label="모바일 텍스트 위치"
            value={banner.text_anchor_mobile}
            onChange={a => onChange({ text_anchor_mobile: a })}
            aspectRatio="aspect-[9/14]"
            backgroundImage={positionBackground}
          />
        </div>
      </div>

      {/* Image focal point (migration 31) — matches the carousel modal's
          image picker. When the wide-source image crops to portrait on
          mobile via object-cover, the focal point keeps the product
          visible. */}
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase mb-1">
          이미지 중심점
        </p>
        <p className="text-[10px] text-[#9ca3af] mb-2">
          이미지가 잘릴 때 어느 지점을 중심으로 보일지 정합니다. 원하는 부분을 클릭하세요.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <ContinuousPositionPicker
            label="PC 이미지 중심점"
            value={banner.image_anchor}
            onChange={a => onChange({ image_anchor: a })}
            aspectRatio="aspect-[16/7]"
            backgroundImage={positionBackground}
            markerColor="#facc15"
          />
          <ContinuousPositionPicker
            label="모바일 이미지 중심점"
            value={banner.image_anchor_mobile}
            onChange={a => onChange({ image_anchor_mobile: a })}
            aspectRatio="aspect-[9/14]"
            backgroundImage={positionBackground}
            markerColor="#facc15"
          />
        </div>
      </div>
    </div>
  );
}
