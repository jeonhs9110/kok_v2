'use client';

import type { Dispatch, SetStateAction } from 'react';
import type { ThemeTokens } from '@/lib/theme/tokens';
import { Section } from './ThemeFormPrimitives';

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

      <div>
        <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">헤더 메뉴 글씨 크기</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {HEADER_MENU_PRESETS.map(opt => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setTokens(t => ({ ...t, header_menu_font_size: opt.v }))}
              className={`p-2 font-semibold border rounded ${
                tokens.header_menu_font_size === opt.v
                  ? 'bg-[#1f2937] text-white border-[#1f2937]'
                  : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#9ca3af] kokkok-keep-border'
              }`}
              style={{ fontSize: opt.v }}
            >
              {opt.l}
            </button>
          ))}
        </div>
        {/* Numeric input for any value the presets don't cover. Header.tsx
            grows above the min-height floor so 40px+ menus don't crop. */}
        <div className="mt-2 flex items-center gap-2">
          <label className="text-[10px] font-bold tracking-widest text-[#6b7280] uppercase">
            직접 입력
          </label>
          <input
            type="number"
            min={10}
            max={48}
            step={1}
            value={parseInt(tokens.header_menu_font_size, 10) || 15}
            onChange={e => {
              const raw = parseInt(e.target.value, 10);
              if (!Number.isFinite(raw)) return;
              const clamped = Math.max(10, Math.min(48, raw));
              setTokens(t => ({ ...t, header_menu_font_size: `${clamped}px` }));
            }}
            className="w-20 px-2 py-1 text-xs rounded"
          />
          <span className="text-[10px] text-[#6b7280]">px (10–48)</span>
        </div>
        <p className="mt-1 text-[10px] text-[#9ca3af]">
          홈페이지 상단 메뉴 (상품·메뉴·Shop Worldwide) 글씨 크기. 모바일 메뉴도 함께 조절됩니다.
          글씨가 커지면 헤더 바도 자동으로 함께 커집니다.
        </p>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">서브헤더 (드롭다운) 글씨 크기</label>
        <div className="grid grid-cols-4 gap-1.5 mt-1">
          {HEADER_SUBMENU_PRESETS.map(opt => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setTokens(t => ({ ...t, header_submenu_font_size: opt.v }))}
              className={`p-2 font-semibold border rounded ${
                tokens.header_submenu_font_size === opt.v
                  ? 'bg-[#1f2937] text-white border-[#1f2937]'
                  : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#9ca3af] kokkok-keep-border'
              }`}
              style={{ fontSize: opt.v }}
            >
              {opt.l}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="text-[10px] font-bold tracking-widest text-[#6b7280] uppercase">
            직접 입력
          </label>
          <input
            type="number"
            min={9}
            max={24}
            step={0.5}
            value={parseFloat(tokens.header_submenu_font_size) || 12.5}
            onChange={e => {
              const raw = parseFloat(e.target.value);
              if (!Number.isFinite(raw)) return;
              const clamped = Math.max(9, Math.min(24, raw));
              setTokens(t => ({ ...t, header_submenu_font_size: `${clamped}px` }));
            }}
            className="w-20 px-2 py-1 text-xs rounded"
          />
          <span className="text-[10px] text-[#6b7280]">px (9–24)</span>
        </div>
        <p className="mt-1 text-[10px] text-[#9ca3af]">
          Product 드롭다운 안의 카테고리 + 하위 항목 (카멜리아 / 앰플세럼 / 크림 등) 글씨 크기.
          상단 메뉴와 별개로 조절됩니다.
        </p>
      </div>

      <div>
        <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">서브 히어로 배너 — 서브타이틀 글씨 크기</label>
        <div className="grid grid-cols-5 gap-1.5 mt-1">
          {SUBHERO_SUBTITLE_PRESETS.map(opt => (
            <button
              key={opt.v}
              type="button"
              onClick={() => setTokens(t => ({ ...t, subhero_subtitle_size: opt.v }))}
              className={`p-2 font-semibold border rounded ${
                tokens.subhero_subtitle_size === opt.v
                  ? 'bg-[#1f2937] text-white border-[#1f2937]'
                  : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#9ca3af] kokkok-keep-border'
              }`}
              style={{ fontSize: opt.v }}
            >
              {opt.l}
            </button>
          ))}
        </div>
        <div className="mt-2 flex items-center gap-2">
          <label className="text-[10px] font-bold tracking-widest text-[#6b7280] uppercase">
            직접 입력
          </label>
          <input
            type="number"
            min={12}
            max={72}
            step={1}
            value={parseInt(tokens.subhero_subtitle_size, 10) || 18}
            onChange={e => {
              const raw = parseInt(e.target.value, 10);
              if (!Number.isFinite(raw)) return;
              const clamped = Math.max(12, Math.min(72, raw));
              setTokens(t => ({ ...t, subhero_subtitle_size: `${clamped}px` }));
            }}
            className="w-20 px-2 py-1 text-xs rounded"
          />
          <span className="text-[10px] text-[#6b7280]">px (12–72)</span>
        </div>
        <p className="mt-1 text-[10px] text-[#9ca3af]">메인 히어로 캐러셀 아래 서브 배너의 작은 부제목 글씨 크기. 개별 배너 옵션(/admin/sub-hero)에서 추가 조정 가능.</p>
      </div>
    </Section>
  );
}
