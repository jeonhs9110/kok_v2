'use client';

import { TypographyPanel } from '@/components/admin/TypographyPanel';
import ContinuousPositionPicker from '@/components/admin/ContinuousPositionPicker';
import type { SlideFormData } from '../_lib';

/**
 * Phase 3 typography + position controls for the carousel slide modal.
 * Three TypographyPanels (뱃지 / 제목 / 부제목 — font + B/I/U + color)
 * followed by two ContinuousPositionPicker pairs (text anchor + image
 * focal point, each with separate PC and mobile anchors). All anchors
 * land in the same migration-30 columns as the SubHero editor.
 *
 * Extracted from CarouselSlideModal at 2026-06-21 as part of the
 * 927-LOC modal split. Section header + intro copy moved with it so
 * the parent stays focused on orchestration.
 */

interface Props {
  formData: SlideFormData;
  /** Live preview image — used as the background of every position picker
   *  so the operator aims relative to the real photo, not a blank rect. */
  previewUrl: string;
  onChange: (patch: Partial<SlideFormData>) => void;
}

export default function SlideTypographyAndPosition({ formData, previewUrl, onChange }: Props) {
  const positionBackground = previewUrl || formData.imageUrl || undefined;

  return (
    <div className="space-y-4 pt-2 border-t border-[#f3f4f6]">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
          타이포그래피
        </p>
        <p className="text-[10px] text-[#9ca3af] mt-0.5">
          폰트와 굵기 / 기울임 / 밑줄을 텍스트별로 지정하고, 텍스트 블록의 위치를 슬라이드 안에서
          골라보세요.
        </p>
      </div>

      <TypographyPanel
        label="뱃지 스타일"
        value={{
          fontFamily: formData.badge_font_family,
          bold: formData.badge_bold,
          italic: formData.badge_italic,
          underline: formData.badge_underline,
          color: formData.badge_text_color,
        }}
        onChange={s =>
          onChange({
            badge_font_family: s.fontFamily,
            badge_bold: s.bold,
            badge_italic: s.italic,
            badge_underline: s.underline,
            badge_text_color: s.color ?? formData.badge_text_color,
          })
        }
        defaultColor="#FFFFFF"
      />
      <TypographyPanel
        label="제목 스타일"
        value={{
          fontFamily: formData.title_font_family,
          bold: formData.title_bold,
          italic: formData.title_italic,
          underline: formData.title_underline,
          color: formData.text_color,
        }}
        onChange={s =>
          onChange({
            title_font_family: s.fontFamily,
            title_bold: s.bold,
            title_italic: s.italic,
            title_underline: s.underline,
            text_color: s.color ?? formData.text_color,
          })
        }
        defaultColor="#111111"
      />
      <TypographyPanel
        label="부제목 스타일"
        value={{
          fontFamily: formData.subtitle_font_family,
          bold: formData.subtitle_bold,
          italic: formData.subtitle_italic,
          underline: formData.subtitle_underline,
          color: formData.text_color,
        }}
        onChange={s =>
          onChange({
            subtitle_font_family: s.fontFamily,
            subtitle_bold: s.bold,
            subtitle_italic: s.italic,
            subtitle_underline: s.underline,
            // hideColor below means s.color is always the unchanged title
            // color — the assignment is a no-op kept for shape parity.
            text_color: s.color ?? formData.text_color,
          })
        }
        defaultColor="#111111"
        hideColor
      />

      {/* Text position — continuous picker (migration 30). PC + mobile
          stored separately because product images often need different
          layouts per breakpoint. */}
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
            value={formData.text_anchor}
            onChange={a => onChange({ text_anchor: a })}
            aspectRatio="aspect-[16/7]"
            backgroundImage={positionBackground}
          />
          <ContinuousPositionPicker
            label="모바일 텍스트 위치"
            value={formData.text_anchor_mobile}
            onChange={a => onChange({ text_anchor_mobile: a })}
            aspectRatio="aspect-[9/14]"
            backgroundImage={positionBackground}
          />
        </div>
      </div>

      {/* Image focal point — same picker, but the anchor drives CSS
          object-position so a feature pins into view even when the wide
          source crops to portrait on mobile. */}
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
            value={formData.image_anchor}
            onChange={a => onChange({ image_anchor: a })}
            aspectRatio="aspect-[16/7]"
            backgroundImage={positionBackground}
            markerColor="#facc15"
          />
          <ContinuousPositionPicker
            label="모바일 이미지 중심점"
            value={formData.image_anchor_mobile}
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
