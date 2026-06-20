'use client';

import { X, LayoutTemplate, Code2 } from 'lucide-react';
import { SUPPORTED_LANGS, LANG_LABELS, type Lang } from '@/lib/i18n/types';
import RichEditor from '@/components/admin/RichEditor';
import PageBlocksEditor from './PageBlocksEditor';
import type { PageBlock } from '@/lib/pages/blocks';

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

          <div className="border border-[#e5e7eb] rounded-lg overflow-hidden">
            <div className="flex border-b border-[#e5e7eb] bg-[#fafbfc]">
              {SUPPORTED_LANGS.map(l => {
                const hasContent = !!(formData.titles[l] || formData.contents[l]);
                return (
                  <button key={l} type="button" onClick={() => onActiveLangChange(l)}
                    className={`px-4 py-2.5 text-xs font-bold tracking-wide transition-colors relative ${
                      activeLang === l
                        ? 'bg-white text-[#1f2937] border-b-2 border-[#3b82f6] -mb-px'
                        : hasContent
                          ? 'text-[#6b7280] hover:bg-[#f3f4f6]'
                          : 'text-[#d1d5db] hover:bg-[#f3f4f6]'
                    }`}>
                    {LANG_LABELS[l]}
                    {hasContent && activeLang !== l && (
                      <span className="ml-1 w-1.5 h-1.5 bg-[#22c55e] rounded-full inline-block" />
                    )}
                  </button>
                );
              })}
            </div>

            <div className="p-4 space-y-4">
              <div className="space-y-1">
                <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
                  페이지 제목 ({LANG_LABELS[activeLang as Lang]}) {activeLang === 'kr' && '*'}
                </label>
                <input
                  type="text"
                  required={activeLang === 'kr'}
                  value={formData.titles[activeLang] || ''}
                  onChange={e => {
                    const val = e.target.value;
                    patch({
                      titles: { ...formData.titles, [activeLang]: val },
                      slug: !editingId && activeLang === 'kr' ? autoSlug(val) : formData.slug,
                    });
                  }}
                  className="w-full p-2.5 text-sm rounded"
                  placeholder={activeLang === 'kr' ? '예: 이벤트 & 공지사항' : `Title in ${LANG_LABELS[activeLang as Lang]}`}
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
                    페이지 내용 ({LANG_LABELS[activeLang as Lang]})
                  </label>
                  <div className="inline-flex bg-[#f3f4f6] rounded p-0.5 text-[11px] font-bold">
                    <button
                      type="button"
                      onClick={() => onEditorModeChange('blocks')}
                      className={`px-2.5 py-1 rounded inline-flex items-center gap-1.5 transition ${
                        editorMode === 'blocks' ? 'bg-white shadow-sm text-[#1f2937]' : 'text-[#6b7280] hover:text-[#1f2937]'
                      }`}
                    >
                      <LayoutTemplate className="w-3 h-3" /> 섹션 빌더
                    </button>
                    <button
                      type="button"
                      onClick={() => onEditorModeChange('rich')}
                      className={`px-2.5 py-1 rounded inline-flex items-center gap-1.5 transition ${
                        editorMode === 'rich' ? 'bg-white shadow-sm text-[#1f2937]' : 'text-[#6b7280] hover:text-[#1f2937]'
                      }`}
                    >
                      <Code2 className="w-3 h-3" /> 클래식 (rich text)
                    </button>
                  </div>
                </div>

                {editorMode === 'blocks' ? (
                  <PageBlocksEditor
                    blocks={formData.blocks[activeLang] || []}
                    onChange={(next) => patch({
                      blocks: { ...formData.blocks, [activeLang]: next },
                    })}
                  />
                ) : (
                  <RichEditor
                    content={formData.contents[activeLang] || ''}
                    onChange={html => patch({
                      contents: { ...formData.contents, [activeLang]: html },
                    })}
                    uploadPath="pages"
                  />
                )}
                <p className="text-[10px] text-[#9ca3af]">
                  두 모드는 독립적으로 저장됩니다. 섹션 빌더에 블록이 있으면 클래식 본문보다 우선합니다.
                </p>
              </div>
            </div>
          </div>

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
