'use client';

import type { SlideFormData } from '../_lib';

/**
 * Font-size offset block for the carousel slide modal — three ± inputs
 * (badge / title / subtitle) that nudge the rendered text size away
 * from the storefront default. Live mini-preview under each input
 * shows the new size in real time so the admin can dial it in without
 * leaving the modal. Extracted from CarouselSlideModal at 2026-06-20
 * as part of the 927-LOC modal split.
 */

type OffsetKey = 'badge_size_offset' | 'title_size_offset' | 'subtitle_size_offset';

interface SizeField {
  key: 'badge' | 'title' | 'subtitle';
  label: string;
  basePx: number;
  sample: string;
}

const FIELDS: SizeField[] = [
  { key: 'badge', label: '뱃지', basePx: 12, sample: '뱃지' },
  { key: 'title', label: '제목', basePx: 48, sample: '제목' },
  { key: 'subtitle', label: '부제목', basePx: 16, sample: '부제목' },
];

interface Props {
  formData: SlideFormData;
  activeLang: string;
  onChange: (key: OffsetKey, value: number) => void;
}

export default function SlideFontSizeOffsets({ formData, activeLang, onChange }: Props) {
  return (
    <div className="space-y-3 pt-2 border-t border-[#f3f4f6]">
      <div>
        <p className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
          폰트 크기 조절
        </p>
        <p className="text-[10px] text-[#9ca3af] mt-0.5">
          기본 크기 대비 ± px 단위로 조정 (예: -4 = 작게, +4 = 크게). 미리보기는 데스크탑 기준
          실제 크기입니다.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {FIELDS.map(({ key, label, basePx, sample }) => {
          const offsetField = `${key}_size_offset` as OffsetKey;
          const offset = formData[offsetField] || 0;
          const effectivePx = basePx + offset;
          const sampleText = (formData[key][activeLang] || sample).split('\n')[0];
          return (
            <div key={key} className="space-y-1">
              <div className="flex items-baseline justify-between">
                <label className="text-[11px] font-semibold text-[#6b7280]">{label}</label>
                <span className="text-[10px] text-[#9ca3af] font-mono">= {effectivePx}px</span>
              </div>
              <input
                type="number"
                value={offset}
                onChange={e => onChange(offsetField, parseInt(e.target.value) || 0)}
                placeholder="0"
                className="w-full rounded px-3 py-2 text-sm"
              />
              <div
                className="px-2 py-1.5 border border-[#e5e7eb] rounded bg-white overflow-hidden truncate"
                style={{ fontSize: `${effectivePx}px`, lineHeight: 1.15 }}
                title={sampleText}
              >
                {sampleText}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
