'use client';

import { useState } from 'react';
import type { ThemeTokens } from '@/lib/theme/tokens';
import HeroSizeViewportPanel from './HeroSizeViewportPanel';

/**
 * Compact viewport-aware hero-height editor — tabs (모바일 / 태블릿 /
 * 데스크탑), 4 preset chips per viewport (rendered by HeroSizeViewportPanel),
 * a numeric input with clamp, plus the gross max-width control.
 *
 * Heights aren't interchangeable — operator wants different defaults at
 * each device (mobile shorter, desktop taller). Tabs make this explicit.
 */

interface Props {
  tokens: ThemeTokens;
  setTokens: React.Dispatch<React.SetStateAction<ThemeTokens>>;
}

type Viewport = 'mobile' | 'tablet' | 'desktop';

const CONFIG = {
  mobile: {
    key: 'hero_height_mobile' as const,
    label: '모바일',
    range: '640px 미만',
    fallback: 700,
    presets: [
      { v: '480px', l: '낮게' },
      { v: '600px', l: '보통' },
      { v: '700px', l: '기본' },
      { v: '820px', l: '높게' },
    ],
    min: 320,
    max: 1200,
  },
  tablet: {
    key: 'hero_height_tablet' as const,
    label: '태블릿',
    range: '640–1023px',
    fallback: 800,
    presets: [
      { v: '600px', l: '낮게' },
      { v: '720px', l: '보통' },
      { v: '800px', l: '기본' },
      { v: '960px', l: '높게' },
    ],
    min: 400,
    max: 1400,
  },
  desktop: {
    key: 'hero_height_desktop' as const,
    label: '데스크탑',
    range: '1024px+',
    fallback: 1000,
    presets: [
      { v: '720px', l: '낮게' },
      { v: '880px', l: '보통' },
      { v: '1000px', l: '기본' },
      { v: '1200px', l: '높게' },
    ],
    min: 520,
    max: 1600,
  },
} satisfies Record<
  Viewport,
  {
    key: 'hero_height_mobile' | 'hero_height_tablet' | 'hero_height_desktop';
    label: string;
    range: string;
    fallback: number;
    presets: { v: string; l: string }[];
    min: number;
    max: number;
  }
>;

const WIDTH_PRESETS = [
  { v: '', l: '전체' },
  { v: '1920px', l: '1920' },
  { v: '1600px', l: '1600' },
  { v: '1280px', l: '1280' },
];

export default function HeroSizeCompact({ tokens, setTokens }: Props) {
  const [vp, setVp] = useState<Viewport>('desktop');

  return (
    <div className="space-y-2">
      {/* Compact viewport tabs */}
      <div className="inline-flex bg-[#f3f4f6] rounded p-0.5 text-[11px] font-bold w-full">
        {(['mobile', 'tablet', 'desktop'] as const).map(k => (
          <button
            key={k}
            type="button"
            onClick={() => setVp(k)}
            className={`flex-1 px-2 py-1 rounded transition-colors ${
              vp === k
                ? 'bg-white shadow-sm text-[#1f2937]'
                : 'text-[#6b7280] hover:text-[#1f2937]'
            }`}
            aria-pressed={vp === k}
          >
            {CONFIG[k].label}
          </button>
        ))}
      </div>

      <HeroSizeViewportPanel tokens={tokens} setTokens={setTokens} config={CONFIG[vp]} />

      {/* Max-width — compact single-row */}
      <div className="pt-2 mt-1 border-t border-[#f3f4f6]">
        <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
          가로 최대 너비
        </label>
        <div className="flex items-center gap-1 mt-1">
          {WIDTH_PRESETS.map(opt => (
            <button
              key={opt.v || 'full'}
              type="button"
              onClick={() => setTokens(t => ({ ...t, hero_max_width: opt.v }))}
              className={`flex-1 px-1 py-1 text-[11px] font-semibold border rounded kokkok-keep-border ${
                tokens.hero_max_width === opt.v
                  ? 'bg-[#1f2937] text-white border-[#1f2937]'
                  : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#9ca3af]'
              }`}
            >
              {opt.l}
            </button>
          ))}
        </div>
        <input
          type="text"
          placeholder="직접 입력 (예: 1440px) — 비워두면 전체"
          value={tokens.hero_max_width}
          onChange={e => setTokens(t => ({ ...t, hero_max_width: e.target.value }))}
          className="w-full mt-1 px-2 py-1 text-[11px] font-mono rounded"
        />
      </div>
      <p className="text-[10px] text-[#9ca3af]">실시간 미리보기에 반영됩니다.</p>
    </div>
  );
}
