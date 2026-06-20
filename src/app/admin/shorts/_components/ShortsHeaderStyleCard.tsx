'use client';

import { Save } from 'lucide-react';

/**
 * Section header (BRAND SHORTS) style editor — text, font size, color,
 * optional background plate. Live preview chip shows the result against
 * the dark section background that BRAND SHORTS sits on by default.
 * Migration 33. Extracted from /admin/shorts/page.tsx at 2026-06-21.
 */

interface Props {
  text: string;
  fontSize: string;
  textColor: string;
  bgEnabled: boolean;
  bgColor: string;
  isSaving: boolean;
  showSavedFlash: boolean;
  onTextChange: (v: string) => void;
  onFontSizeChange: (v: string) => void;
  onTextColorChange: (v: string) => void;
  onBgEnabledChange: (v: boolean) => void;
  onBgColorChange: (v: string) => void;
  onSave: () => void;
}

export default function ShortsHeaderStyleCard({
  text,
  fontSize,
  textColor,
  bgEnabled,
  bgColor,
  isSaving,
  showSavedFlash,
  onTextChange,
  onFontSizeChange,
  onTextColorChange,
  onBgEnabledChange,
  onBgColorChange,
  onSave,
}: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-bold text-[#1f2937]">섹션 제목</h2>
        <p className="text-xs text-[#9ca3af]">기본은 &ldquo;BRAND SHORTS&rdquo; · 흰색 · 15px.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
            제목 텍스트
          </label>
          <input
            type="text"
            value={text}
            onChange={e => onTextChange(e.target.value)}
            placeholder="BRAND SHORTS"
            className="w-full mt-1 px-3 py-2 text-sm rounded"
          />
          <p className="text-[10px] text-[#9ca3af] mt-1">
            비워두면 기본값 &ldquo;BRAND SHORTS&rdquo;가 표시됩니다.
          </p>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
            글자 크기 (px)
          </label>
          <input
            type="number"
            min={10}
            max={48}
            step={1}
            value={fontSize}
            onChange={e => onFontSizeChange(e.target.value)}
            className="w-full mt-1 px-3 py-2 text-sm rounded"
          />
          <p className="text-[10px] text-[#9ca3af] mt-1">10–48 사이. 기본 15.</p>
        </div>
        <div>
          <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
            글자 색상
          </label>
          <div className="flex items-center gap-2 mt-1">
            <input
              type="color"
              value={textColor}
              onChange={e => onTextColorChange(e.target.value)}
              className="w-10 h-10 rounded border border-[#d1d5db] cursor-pointer p-0 kokkok-keep-border"
            />
            <input
              type="text"
              value={textColor}
              onChange={e => onTextColorChange(e.target.value)}
              className="flex-1 px-3 py-2 text-sm font-mono rounded"
            />
          </div>
        </div>
        <div>
          <label className="flex items-center gap-2 text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider cursor-pointer">
            <input
              type="checkbox"
              checked={bgEnabled}
              onChange={e => onBgEnabledChange(e.target.checked)}
              className="w-3.5 h-3.5"
            />
            제목 뒤 배경 색상 사용
          </label>
          <div
            className={`flex items-center gap-2 mt-1 ${!bgEnabled ? 'opacity-40 pointer-events-none' : ''}`}
          >
            <input
              type="color"
              value={bgColor}
              onChange={e => onBgColorChange(e.target.value)}
              className="w-10 h-10 rounded border border-[#d1d5db] cursor-pointer p-0 kokkok-keep-border"
            />
            <input
              type="text"
              value={bgColor}
              onChange={e => onBgColorChange(e.target.value)}
              className="flex-1 px-3 py-2 text-sm font-mono rounded"
            />
          </div>
          <p className="text-[10px] text-[#9ca3af] mt-1">
            체크 해제 시 섹션 배경 위에 그대로 노출됩니다.
          </p>
        </div>
      </div>

      {/* Live preview chip against the dark shorts section bg */}
      <div className="pt-3 border-t border-[#f3f4f6]">
        <p className="text-[10px] font-semibold text-[#9ca3af] uppercase tracking-wider mb-2">
          미리보기
        </p>
        <div className="flex justify-center py-6 bg-neutral-900 rounded">
          <h3
            className="font-bold tracking-widest uppercase"
            style={{
              color: textColor,
              fontSize: `${Math.max(10, Math.min(48, parseInt(fontSize, 10) || 15))}px`,
              backgroundColor: bgEnabled ? bgColor : undefined,
              padding: bgEnabled ? '0.5rem 1rem' : undefined,
              borderRadius: bgEnabled ? '0.25rem' : undefined,
            }}
          >
            {text.trim() || 'BRAND SHORTS'}
          </h3>
        </div>
      </div>

      <button
        onClick={onSave}
        disabled={isSaving}
        className={`px-5 py-2 rounded text-xs font-semibold transition-all flex items-center gap-2 ${
          showSavedFlash ? 'bg-[#16a34a] text-white' : 'bg-[#1f2937] text-white hover:bg-[#111827]'
        } disabled:opacity-50`}
      >
        <Save className="w-3.5 h-3.5" />
        {isSaving ? '저장 중...' : showSavedFlash ? '✓ 저장 완료' : '제목 스타일 저장'}
      </button>
    </div>
  );
}
