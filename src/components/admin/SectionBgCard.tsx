'use client';

import { Save } from 'lucide-react';
import SectionBackgroundPanel, { type SectionBgValue } from './SectionBackgroundPanel';

interface Props {
  value: SectionBgValue;
  onChange: (next: SectionBgValue) => void;
  defaultColor: string;
  uploadPathPrefix: string;
  isSaving: boolean;
  showSavedFlash: boolean;
  onSave: () => void;
  /** Sub-headline below the "섹션 배경" heading. */
  hint?: string;
}

/**
 * Shared "섹션 배경" card — the section title + SectionBackgroundPanel +
 * save button trio that /admin/shorts and /admin/instagram both render
 * inline. Co-located in src/components/admin/ so future Cafe24-style
 * sections (carousel, reviews, sub-hero) can adopt the same surface
 * without duplicating the chrome.
 */
export default function SectionBgCard({
  value,
  onChange,
  defaultColor,
  uploadPathPrefix,
  isSaving,
  showSavedFlash,
  onSave,
  hint,
}: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-5 space-y-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-bold text-[#1f2937]">섹션 배경</h2>
        {hint && <p className="text-xs text-[#9ca3af]">{hint}</p>}
      </div>
      <SectionBackgroundPanel
        value={value}
        onChange={onChange}
        defaultColor={defaultColor}
        uploadPathPrefix={uploadPathPrefix}
      />
      <button
        onClick={onSave}
        disabled={isSaving}
        className={`px-5 py-2 rounded text-xs font-semibold transition-all flex items-center gap-2 ${
          showSavedFlash ? 'bg-[#16a34a] text-white' : 'bg-[#1f2937] text-white hover:bg-[#111827]'
        } disabled:opacity-50`}
      >
        <Save className="w-3.5 h-3.5" />
        {isSaving ? '저장 중...' : showSavedFlash ? '✓ 저장 완료' : '배경 저장'}
      </button>
    </div>
  );
}
