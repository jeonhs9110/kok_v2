'use client';

import type { SubHero } from './types';

interface Props {
  banner: SubHero;
  isSaving: boolean;
  onChange: (patch: Partial<SubHero>) => void;
  onSave: () => void;
}

/**
 * Title / Subtitle / Link URL / Active checkbox / Save button.
 * Pulled out of /admin/sub-hero/page.tsx so the parent reads as
 * orchestration (preview, image upload, typography panel, then this).
 */
export default function SubHeroBasicFields({ banner, isSaving, onChange, onSave }: Props) {
  return (
    <>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">제목 (선택)</label>
        <input
          type="text"
          value={banner.title}
          onChange={e => onChange({ title: e.target.value })}
          placeholder="예: Available worldwide"
          className="w-full rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">서브타이틀 (선택)</label>
        <input
          type="text"
          value={banner.subtitle}
          onChange={e => onChange({ subtitle: e.target.value })}
          placeholder="예: Let's make together"
          className="w-full rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">클릭 링크 URL (선택)</label>
        <input
          type="text"
          value={banner.link_url}
          onChange={e => onChange({ link_url: e.target.value })}
          placeholder="https://example.com 또는 /kr/worldwide"
          className="w-full rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="flex items-center gap-3">
        <input
          type="checkbox"
          id="subHeroActive"
          checked={banner.is_active}
          onChange={e => onChange({ is_active: e.target.checked })}
          className="w-4 h-4 accent-[#00693A] cursor-pointer"
        />
        <label htmlFor="subHeroActive" className="text-sm font-semibold text-[#374151] cursor-pointer select-none">
          홈페이지에 표시
        </label>
      </div>

      <button
        onClick={onSave}
        disabled={isSaving || !banner.image_url}
        className="w-full bg-[#3b82f6] text-white py-3 rounded text-sm font-bold tracking-widest hover:bg-[#2563eb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isSaving ? (
          <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
        ) : '배너 저장'}
      </button>
    </>
  );
}
