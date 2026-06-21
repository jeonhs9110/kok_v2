'use client';

import { X } from 'lucide-react';
import RichEditor from '@/components/admin/RichEditor';
import { SUPPORTED_LANGS, LANG_LABELS, type Lang } from '@/lib/i18n/types';
import type { Menu } from '@/lib/api/menus';
import { useModalA11y } from '@/hooks/useModalA11y';

export interface MenuFormData {
  slug: string;
  parent_id: string;
  page_type: 'page' | 'board';
  board_write_role: 'admin' | 'user';
  show_in_nav: boolean;
  sort_order: number;
  is_published: boolean;
  title: Record<string, string>;
  content: Record<string, string>;
}

interface Props {
  open: boolean;
  editingId: string | null;
  form: MenuFormData;
  parents: Menu[];
  activeLang: Lang;
  onActiveLangChange: (l: Lang) => void;
  onFormChange: (next: MenuFormData) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function MenuModal({
  open,
  editingId,
  form,
  parents,
  activeLang,
  onActiveLangChange,
  onFormChange,
  onClose,
  onSave,
}: Props) {
  const dialogRef = useModalA11y(open, onClose);

  if (!open) return null;

  const patch = (p: Partial<MenuFormData>) => onFormChange({ ...form, ...p });

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="menu-modal-title"
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#e5e7eb] bg-[#fafbfc]">
          <h3 id="menu-modal-title" className="text-[14px] font-bold text-[#1f2937]">{editingId ? '메뉴 수정' : '메뉴 추가'}</h3>
          <button onClick={onClose} aria-label="닫기" className="text-[#9ca3af] hover:text-[#1f2937] p-1 rounded hover:bg-[#f3f4f6] transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">분류</label>
              <select value={form.parent_id} onChange={e => patch({ parent_id: e.target.value })} className="w-full rounded-lg px-3 py-2.5 text-sm">
                <option value="">최상위 메뉴</option>
                {parents.filter(p => p.id !== editingId).map(p => (
                  <option key={p.id} value={p.id}>↳ {p.title.kr || p.slug}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">슬러그 (URL)</label>
              <input type="text" value={form.slug} onChange={e => patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} placeholder="예: events, brand-story" className="w-full rounded-lg px-3 py-2.5 text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">페이지 타입</label>
              <select value={form.page_type} onChange={e => patch({ page_type: e.target.value as 'page' | 'board' })} className="w-full rounded-lg px-3 py-2.5 text-sm">
                <option value="page">단순 페이지 (글)</option>
                <option value="board">게시판 (게시글 목록)</option>
              </select>
            </div>
            {form.page_type === 'board' && (
              <div>
                <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">글쓰기 권한</label>
                <select value={form.board_write_role} onChange={e => patch({ board_write_role: e.target.value as 'admin' | 'user' })} className="w-full rounded-lg px-3 py-2.5 text-sm">
                  <option value="admin">관리자만</option>
                  <option value="user">소비자도 가능</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#6b7280] mb-2">다국어 콘텐츠</label>
            <div className="flex gap-1 mb-3">
              {SUPPORTED_LANGS.map(l => (
                <button key={l} type="button" onClick={() => onActiveLangChange(l)} className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${activeLang === l ? 'bg-[#1f2937] text-white' : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'}`}>
                  {LANG_LABELS[l]}
                  {(form.title[l] || form.content[l]) && <span className="ml-1 w-1.5 h-1.5 bg-[#22c55e] rounded-full inline-block" />}
                </button>
              ))}
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] text-[#9ca3af] mb-1">메뉴명 ({LANG_LABELS[activeLang]}) {activeLang === 'kr' && '*'}</label>
                <input type="text" value={form.title[activeLang] || ''} onChange={e => patch({ title: { ...form.title, [activeLang]: e.target.value } })} className="w-full rounded-lg px-3 py-2 text-sm" />
              </div>

              {form.page_type === 'page' && (
                <div>
                  <label className="block text-[10px] text-[#9ca3af] mb-1">콘텐츠 ({LANG_LABELS[activeLang]})</label>
                  {/* Rich editor (TipTap). The rendered HTML is sanitized by MenuPage before being dangerouslySetInnerHTML'd. */}
                  <RichEditor
                    key={`${editingId ?? 'new'}-${activeLang}`}
                    content={form.content[activeLang] || ''}
                    onChange={(html) => patch({ content: { ...form.content, [activeLang]: html } })}
                    uploadPath={`menus/${form.slug || 'draft'}`}
                    minHeight={320}
                  />
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">정렬 순서</label>
              <input type="number" value={form.sort_order} onChange={e => patch({ sort_order: Number(e.target.value) })} className="w-full rounded-lg px-3 py-2.5 text-sm" />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_published} onChange={e => patch({ is_published: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="text-sm text-[#374151]">게시</span>
              </label>
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.show_in_nav} onChange={e => patch({ show_in_nav: e.target.checked })} className="w-4 h-4 rounded" />
                <span className="text-sm text-[#374151]">네비 표시</span>
              </label>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-[#e5e7eb] bg-[#fafbfc] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2.5 border border-[#d1d5db] text-[#374151] rounded text-sm font-semibold bg-white hover:bg-[#f9fafb] transition-colors kokkok-keep-border">취소</button>
          <button onClick={onSave} className="px-6 py-2.5 bg-[#3b82f6] text-white text-sm font-semibold rounded-lg hover:bg-[#2563eb] transition-colors">
            {editingId ? '수정' : '추가'}
          </button>
        </div>
      </div>
    </div>
  );
}
