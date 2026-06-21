'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ThemeTokens } from '@/lib/theme/tokens';
import { Section } from './ThemeFormPrimitives';
import FontSizePresetPicker from './FontSizePresetPicker';

interface Props {
  tokens: ThemeTokens;
  setTokens: Dispatch<SetStateAction<ThemeTokens>>;
}

const RADIUS_PRESETS = [
  { v: '0px', l: '직각' },
  { v: '6px', l: '약간' },
  { v: '12px', l: '둥글게' },
  { v: '9999px', l: '알약' },
];

const HEADER_MENU_PRESETS = [
  // Labels renamed 2026-06-08 after the default moved 13.5px → 15px.
  { v: '13.5px', l: '작게' },
  { v: '15px',   l: '기본' },
  { v: '17px',   l: '크게' },
  { v: '19px',   l: '더 크게' },
];

const HEADER_SUBMENU_PRESETS = [
  { v: '11px',   l: '작게' },
  { v: '12.5px', l: '기본' },
  { v: '14px',   l: '크게' },
  { v: '17px',   l: '더 크게' },
];

const SUBHERO_SUBTITLE_PRESETS = [
  // Range extended 12-28 → 12-72 (2026-06-10 boss-meeting follow-up).
  { v: '16px', l: '작게' },
  { v: '18px', l: '기본' },
  { v: '24px', l: '크게' },
  { v: '28px', l: '더 크게' },
  { v: '32px', l: '아주 크게' },
];

export default function ShapeSection({ tokens, setTokens }: Props) {
  return (
    <Section title="모양">
      <div>
        <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">버튼 모서리</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {RADIUS_PRESETS.map(opt => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setTokens(t => ({ ...t, radius_button: opt.v }))}
              className={`p-2 text-xs font-semibold border ${
                tokens.radius_button === opt.v
                  ? 'bg-[#1f2937] text-white border-[#1f2937]'
                  : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:border-[#9ca3af] kokkok-keep-border'
              }`}
              style={{ borderRadius: opt.v === '9999px' ? '9999px' : opt.v }}
            >
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      <FontSizePresetPicker
        label="헤더 메뉴 글씨 크기"
        value={tokens.header_menu_font_size}
        onChange={v => setTokens(t => ({ ...t, header_menu_font_size: v }))}
        presets={HEADER_MENU_PRESETS}
        gridCols={4}
        min={10}
        max={48}
        step={1}
        fallback={15}
        hint="px (10–48)"
      />
      <p className="-mt-3 text-[10px] text-[#9ca3af]">
        홈페이지 상단 메뉴 (상품·메뉴·Shop Worldwide) 글씨 크기. 모바일 메뉴도 함께 조절됩니다.
        글씨가 커지면 헤더 바도 자동으로 함께 커집니다.
      </p>

      <FontSizePresetPicker
        label="서브헤더 (드롭다운) 글씨 크기"
        value={tokens.header_submenu_font_size}
        onChange={v => setTokens(t => ({ ...t, header_submenu_font_size: v }))}
        presets={HEADER_SUBMENU_PRESETS}
        gridCols={4}
        min={9}
        max={24}
        step={0.5}
        fallback={12.5}
        hint="px (9–24)"
        parseFloatMode
      />
      <p className="-mt-3 text-[10px] text-[#9ca3af]">
        Product 드롭다운 안의 카테고리 + 하위 항목 (카멜리아 / 앰플세럼 / 크림 등) 글씨 크기.
        상단 메뉴와 별개로 조절됩니다.
      </p>

      <FontSizePresetPicker
        label="서브 히어로 배너 — 서브타이틀 글씨 크기"
        value={tokens.subhero_subtitle_size}
        onChange={v => setTokens(t => ({ ...t, subhero_subtitle_size: v }))}
        presets={SUBHERO_SUBTITLE_PRESETS}
        gridCols={5}
        min={12}
        max={72}
        step={1}
        fallback={18}
        hint="px (12–72)"
      />
      <p className="-mt-3 text-[10px] text-[#9ca3af]">메인 히어로 캐러셀 아래 서브 배너의 작은 부제목 글씨 크기. 개별 배너 옵션(/admin/sub-hero)에서 추가 조정 가능.</p>
    </Section>
  );
}
