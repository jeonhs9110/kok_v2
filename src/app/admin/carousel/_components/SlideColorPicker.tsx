'use client';

import type { SlideFormData } from '../_lib';

/**
 * Color-settings block for the carousel slide modal — 4 color pickers
 * laid out 2×2 (배경 / 텍스트 / 뱃지 배경 / 뱃지 텍스트). Extracted from
 * CarouselSlideModal at 2026-06-20 as part of the 927-LOC modal split.
 */

type ColorKey =
  | 'bg_color'
  | 'text_color'
  | 'badge_bg_color'
  | 'badge_text_color';

interface ColorField {
  key: ColorKey;
  label: string;
}

const FIELDS: ColorField[] = [
  { key: 'bg_color', label: '배경색' },
  { key: 'text_color', label: '제목·부제목 색상' },
  { key: 'badge_bg_color', label: '뱃지 배경색' },
  { key: 'badge_text_color', label: '뱃지 폰트 색상' },
];

interface Props {
  formData: SlideFormData;
  onChange: (key: ColorKey, value: string) => void;
}

export default function SlideColorPicker({ formData, onChange }: Props) {
  return (
    <div className="space-y-3 pt-2 border-t border-[#f3f4f6]">
      <p className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
        색상 설정
      </p>
      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map(({ key, label }) => (
          <div key={key} className="space-y-1">
            <label className="text-[11px] font-semibold text-[#6b7280]">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={formData[key]}
                onChange={e => onChange(key, e.target.value)}
                className="w-14 h-10 rounded border border-[#d1d5db] cursor-pointer p-0 kokkok-keep-border"
              />
              <input
                type="text"
                value={formData[key]}
                onChange={e => onChange(key, e.target.value)}
                className="flex-1 rounded px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
