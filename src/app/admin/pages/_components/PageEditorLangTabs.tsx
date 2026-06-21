'use client';

import { LayoutTemplate, Code2 } from 'lucide-react';
import { SUPPORTED_LANGS, LANG_LABELS, type Lang } from '@/lib/i18n/types';
import RichEditor from '@/components/admin/RichEditor';
import PageBlocksEditor from './PageBlocksEditor';
import type { PageEditorFormData } from './PageEditorModal';

interface Props {
  editingId: string | null;
  activeLang: string;
  editorMode: 'blocks' | 'rich';
  formData: PageEditorFormData;
  onActiveLangChange: (l: string) => void;
  onEditorModeChange: (m: 'blocks' | 'rich') => void;
  onPatch: (p: Partial<PageEditorFormData>) => void;
  autoSlug: (title: string) => string;
}

/**
 * Multi-language tab strip + the active-lang content (title + body) for
 * PageEditorModal. The title input on the kr tab also auto-derives the
 * slug for new pages (rows already saved keep their slug). The
 * blocks/rich mode toggle persists across language switches because both
 * surfaces serialize per-language under formData.{blocks,contents}.
 */
export default function PageEditorLangTabs({
  editingId,
  activeLang,
  editorMode,
  formData,
  onActiveLangChange,
  onEditorModeChange,
  onPatch,
  autoSlug,
}: Props) {
  return (
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
              onPatch({
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
              onChange={(next) => onPatch({
                blocks: { ...formData.blocks, [activeLang]: next },
              })}
            />
          ) : (
            <RichEditor
              content={formData.contents[activeLang] || ''}
              onChange={html => onPatch({
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
  );
}
