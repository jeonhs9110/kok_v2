'use client';

import ContinuousPositionPicker from '@/components/admin/ContinuousPositionPicker';
import type { SlideFormData } from '../_lib';

/**
 * Text-block position + image focal point pickers for the carousel
 * slide modal. Per boss 2026-06-22 these stay below the element groups
 * unchanged — they're slide-level decisions about WHERE the text block
 * sits as a whole, not per-element styling.
 *
 * Carved out of SlideTypographyAndPosition during the 2026-06-22 form
 * refactor — the typography parts of that component moved into the new
 * per-element SlideElementGroup; only the two position pickers remain.
 */

interface Props {
  formData: SlideFormData;
  /** Live preview image — used as the background of every position picker
   *  so the operator aims relative to the real photo, not a blank rect. */
  previewUrl: string;
  onChange: (patch: Partial<SlideFormData>) => void;
}

export default function SlidePositionSection({ formData, previewUrl, onChange }: Props) {
  const positionBackground = previewUrl || formData.imageUrl || undefined;

  return (
    <div className="space-y-4 pt-3 border-t border-[#e5e7eb]">
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
