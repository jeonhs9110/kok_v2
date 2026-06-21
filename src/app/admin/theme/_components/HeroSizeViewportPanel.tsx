'use client';

import type { ThemeTokens } from '@/lib/theme/tokens';

type HeroHeightKey = 'hero_height_mobile' | 'hero_height_tablet' | 'hero_height_desktop';

interface Props {
  tokens: ThemeTokens;
  setTokens: React.Dispatch<React.SetStateAction<ThemeTokens>>;
  config: {
    key: HeroHeightKey;
    label: string;
    range: string;
    fallback: number;
    presets: { v: string; l: string }[];
    min: number;
    max: number;
  };
}

/**
 * Hero-height preset chips + numeric input for ONE viewport (mobile /
 * tablet / desktop). The parent <HeroSizeCompact /> swaps which viewport's
 * config flows in based on the current tab. Each preset shows its label
 * + the raw px value beneath; the numeric input clamps to [min, max] on
 * commit.
 */
export default function HeroSizeViewportPanel({ tokens, setTokens, config: c }: Props) {
  const value = tokens[c.key];
  const parsed = parseInt(value, 10);
  const safe = Number.isFinite(parsed) ? parsed : c.fallback;

  return (
    <>
      <p className="text-[10px] text-[#9ca3af] -mt-0.5">
        {c.label} ({c.range}) 화면에서 보이는 높이
      </p>

      <div className="grid grid-cols-4 gap-1">
        {c.presets.map(opt => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setTokens(t => ({ ...t, [c.key]: opt.v }))}
            className={`px-1.5 py-1.5 text-[11px] font-semibold border rounded kokkok-keep-border ${
              value === opt.v
                ? 'bg-[#1f2937] text-white border-[#1f2937]'
                : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#9ca3af]'
            }`}
          >
            {opt.l}
            <div className="text-[9px] opacity-60 font-normal">{parseInt(opt.v, 10)}</div>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2">
        <input
          type="number"
          min={c.min}
          max={c.max}
          step={10}
          value={safe}
          onChange={e => {
            const raw = parseInt(e.target.value, 10);
            if (!Number.isFinite(raw)) return;
            const clamped = Math.max(c.min, Math.min(c.max, raw));
            setTokens(t => ({ ...t, [c.key]: `${clamped}px` }));
          }}
          className="w-20 px-2 py-1 text-xs rounded"
        />
        <span className="text-[10px] text-[#6b7280]">px ({c.min}–{c.max})</span>
      </div>
    </>
  );
}
