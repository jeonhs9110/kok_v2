'use client';

import { X } from 'lucide-react';
import type { PageBlock } from '@/lib/pages/blocks';
import PageEditorLangTabs from './PageEditorLangTabs';

type LangMap = Record<string, string>;
type BlocksMap = Record<string, PageBlock[]>;

export interface PageEditorFormData {
  titles: LangMap;
  slug: string;
  contents: LangMap;
  blocks: BlocksMap;
  is_published: boolean;
  show_in_nav: boolean;
  nav_order: number;
}

interface Props {
  editingId: string | null;
  activeLang: string;
  editorMode: 'blocks' | 'rich';
  formData: PageEditorFormData;
  isSubmitting: boolean;
  onClose: () => void;
  onActiveLangChange: (l: string) => void;
  onEditorModeChange: (m: 'blocks' | 'rich') => void;
  onFormChange: (next: PageEditorFormData) => void;
  onSubmit: (e: React.FormEvent) => void;
  autoSlug: (title: string) => string;
}

export default function PageEditorModal({
  editingId,
  activeLang,
  editorMode,
  formData,
  isSubmitting,
  onClose,
  onActiveLangChange,
  onEditorModeChange,
  onFormChange,
  onSubmit,
  autoSlug,
}: Props) {
  const patch = (p: Partial<PageEditorFormData>) => onFormChange({ ...formData, ...p });

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 border-b border-[#e5e7eb] flex justify-between items-center bg-[#fafbfc]">
          <h3 className="text-[14px] font-bold text-[#1f2937]">{editingId ? '페이지 수정' : '새 페이지'}</h3>
          <button onClick={onClose} className="text-[#9ca3af] hover:text-[#1f2937] p-1 rounded hover:bg-[#f3f4f6] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={onSubmit} className="p-6 overflow-y-auto space-y-5">
          <div className="space-y-1">
            <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">URL 경로 (slug) *</label>
            <div className="flex items-center gap-1">
              <span className="text-xs text-[#9ca3af]">/pages/</span>
              <input
                required type="text" value={formData.slug}
                onChange={e => patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
                className="flex-1 p-2.5 text-sm rounded font-mono"
                placeholder="events"
              />
            </div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formData.is_published}
                onChange={e => patch({ is_published: e.target.checked })}
                className="w-4 h-4 rounded" />
              <span className="text-sm font-medium text-[#374151]">게시 (공개)</span>
            </label>
            <label className="flex items-center gap-2">
              <input type="checkbox" checked={formData.show_in_nav}
                onChange={e => patch({ show_in_nav: e.target.checked })}
                className="w-4 h-4 rounded" />
              <span className="text-sm font-medium text-[#374151]">헤더 메뉴에 표시</span>
            </label>
            {formData.show_in_nav && (
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-[#374151]">순서:</span>
                <input type="number" min="0" value={formData.nav_order}
                  onChange={e => patch({ nav_order: Number(e.target.value) })}
                  className="w-16 p-1.5 text-sm rounded text-center" />
              </div>
            )}
          </div>

          <PageEditorLangTabs
            editingId={editingId}
            activeLang={activeLang}
            editorMode={editorMode}
            formData={formData}
            onActiveLangChange={onActiveLangChange}
            onEditorModeChange={onEditorModeChange}
            onPatch={patch}
            autoSlug={autoSlug}
          />

          <div className="pt-4 border-t border-[#e5e7eb] flex justify-end gap-2">
            <button type="button" onClick={onClose}
              className="px-6 py-2.5 border border-[#d1d5db] text-[#374151] rounded text-sm font-semibold bg-white hover:bg-[#f9fafb] transition-colors kokkok-keep-border">
              취소
            </button>
            <button type="submit" disabled={isSubmitting}
              className="bg-[#3b82f6] text-white px-8 py-2.5 rounded text-sm font-bold tracking-widest hover:bg-[#2563eb] transition-colors disabled:opacity-50 flex items-center gap-2">
              {isSubmitting ? (
                <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
              ) : editingId ? '수정 저장' : '페이지 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
