'use client';

/**
 * Display-mode toggle for the carousel slide modal — pick between
 * "기본형" (text + image side-by-side) and "풀페이지" (text overlaid
 * on a full-bleed image). Extracted from CarouselSlideModal at
 * 2026-06-20 as part of the 927-LOC modal split.
 */

interface Props {
  value: 'default' | 'fullpage';
  onChange: (next: 'default' | 'fullpage') => void;
}

interface ModeOption {
  key: 'default' | 'fullpage';
  label: string;
  description: string;
  preview: React.ReactNode;
}

const MODES: ModeOption[] = [
  {
    key: 'default',
    label: '기본형',
    description: '텍스트 + 이미지 분리 레이아웃',
    preview: (
      <div className="w-8 h-5 rounded border border-[#d1d5db] bg-[#f3f4f6] flex">
        <div className="w-1/2 flex items-center justify-center text-[6px] text-[#9ca3af]">T</div>
        <div className="w-1/2 bg-[#d1d5db] rounded-r" />
      </div>
    ),
  },
  {
    key: 'fullpage',
    label: '풀페이지',
    description: '이미지 전체 배너 (텍스트 오버레이)',
    preview: (
      <div className="w-8 h-5 rounded border border-[#d1d5db] bg-[#9ca3af] flex items-center justify-center text-[6px] text-white font-bold">
        FULL
      </div>
    ),
  },
];

export default function SlideDisplayModePicker({ value, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
        배너 표시 모드
      </label>
      <div className="grid grid-cols-2 gap-3">
        {MODES.map(mode => {
          const isActive = value === mode.key;
          return (
            <button
              key={mode.key}
              type="button"
              onClick={() => onChange(mode.key)}
              className={`p-3 rounded border-2 text-left transition-all ${
                isActive
                  ? 'border-[#3b82f6] bg-[#eff6ff]'
                  : 'border-[#e5e7eb] hover:border-[#d1d5db]'
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {mode.preview}
                <span className="text-sm font-semibold text-[#1f2937]">{mode.label}</span>
              </div>
              <p className="text-[10px] text-[#6b7280]">{mode.description}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
