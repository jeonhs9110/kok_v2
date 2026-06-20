'use client';

import { Save } from 'lucide-react';
import type { ThemeTokens } from '@/lib/theme/tokens';

/**
 * Logo height picker — 4 preset chips + a numeric direct-input clamp
 * between 20 and 150px. Writes go into the shared theme_tokens row via
 * the parent's setTokens; same picker pattern as the button-radius and
 * menu-font controls on /admin/theme.
 *
 * Extracted from /admin/logo/page.tsx at 2026-06-21.
 */

const PRESETS: { v: string; l: string }[] = [
  { v: '40px', l: '작게' },
  { v: '56px', l: '기본' },
  { v: '80px', l: '크게' },
  { v: '120px', l: '아주 크게' },
];

interface Props {
  tokens: ThemeTokens;
  setTokens: React.Dispatch<React.SetStateAction<ThemeTokens>>;
  savedTokens: ThemeTokens;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
}

export default function LogoSizeCard({
  tokens,
  setTokens,
  savedTokens,
  isDirty,
  isSaving,
  onSave,
}: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-5">
      <h2 className="text-[14px] font-bold text-[#1f2937] mb-1">로고 크기</h2>
      <p className="text-sm text-[#6b7280] mb-4">
        상단 헤더에 표시되는 로고의 높이를 조절합니다. 가로 폭은 비율을 유지한 채 자동으로
        맞춰집니다. 오른쪽 미리보기가 실시간으로 반영됩니다.
      </p>

      <div className="grid grid-cols-4 gap-1.5">
        {PRESETS.map(opt => (
          <button
            key={opt.v}
            type="button"
            onClick={() => setTokens(t => ({ ...t, header_logo_height: opt.v }))}
            className={`p-3 text-xs font-semibold border rounded ${
              tokens.header_logo_height === opt.v
                ? 'bg-[#1f2937] text-white border-[#1f2937]'
                : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#9ca3af]'
            }`}
          >
            <div className="flex flex-col items-center gap-1">
              <span>{opt.l}</span>
              <span className="text-[10px] opacity-70">{opt.v}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Numeric input for any height the presets don't cover (e.g.
          44px between 기본 40 and 크게 48). Range-clamped to 20–150px;
          the header bar's min-height grows with the logo via
          .kokkok-header-bar's calc(logo + 24px) so larger sizes don't
          crop. */}
      <div className="mt-3 flex items-center gap-2">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
          직접 입력
        </label>
        <input
          type="number"
          min={20}
          max={150}
          step={1}
          value={parseInt(tokens.header_logo_height, 10) || 56}
          onChange={e => {
            const raw = parseInt(e.target.value, 10);
            if (!Number.isFinite(raw)) return;
            const clamped = Math.max(20, Math.min(150, raw));
            setTokens(t => ({ ...t, header_logo_height: `${clamped}px` }));
          }}
          className="w-20 px-2 py-1.5 text-sm rounded"
        />
        <span className="text-xs text-[#6b7280]">px (20–150)</span>
      </div>
      <p className="mt-2 text-[10px] text-[#6b7280]">
        로고가 커지면 상단 헤더 바도 자동으로 함께 커집니다 — 잘리지 않습니다.
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="button"
          onClick={onSave}
          disabled={!isDirty || isSaving}
          className="inline-flex items-center gap-2 bg-[#3b82f6] text-white px-5 py-2 text-sm font-bold tracking-wider hover:bg-[#2563eb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded"
        >
          <Save className="w-4 h-4" />
          {isSaving ? '저장 중...' : isDirty ? '로고 크기 저장' : '저장됨'}
        </button>
        {isDirty && (
          <button
            type="button"
            onClick={() => setTokens(savedTokens)}
            className="text-xs text-[#6b7280] hover:text-[#1f2937] underline underline-offset-2"
          >
            되돌리기
          </button>
        )}
      </div>
    </div>
  );
}
