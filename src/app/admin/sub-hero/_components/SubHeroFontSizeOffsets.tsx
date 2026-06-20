'use client';

import type { SubHero } from './types';

/**
 * Title + subtitle font-size offset nudges with live mini-preview tiles
 * under each one. Same shape as the carousel modal's SlideFontSizeOffsets
 * but tuned for 2 fields instead of 3.
 *
 * Extracted from /admin/sub-hero/page.tsx at 2026-06-21.
 */

type OffsetKey = 'title_size_offset' | 'subtitle_size_offset';

const FIELDS: { key: 'title' | 'subtitle'; label: string; basePx: number; sample: string }[] = [
  { key: 'title', label: '제목', basePx: 48, sample: '제목' },
  { key: 'subtitle', label: '서브타이틀', basePx: 16, sample: '서브타이틀' },
];

interface Props {
  banner: SubHero;
  onChange: (key: OffsetKey, value: number) => void;
}

export default function SubHeroFontSizeOffsets({ banner, onChange }: Props) {
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
      <div className="grid grid-cols-2 gap-4">
        {FIELDS.map(({ key, label, basePx, sample }) => {
          const offsetField = `${key}_size_offset` as OffsetKey;
          const offset = banner[offsetField] || 0;
          const effectivePx = basePx + offset;
          const sampleText = banner[key] || sample;
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
