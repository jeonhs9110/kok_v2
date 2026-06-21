'use client';

import { X } from 'lucide-react';
import { SUPPORTED_LANGS, LANG_LABELS } from '@/lib/i18n/types';
import type { Category } from '@/lib/api/categories';
import { useModalA11y } from '@/hooks/useModalA11y';

export interface CategoryFormData {
  slug: string;
  parent_id: string;
  sort_order: number;
  is_active: boolean;
  name: Record<string, string>;
}

interface Props {
  open: boolean;
  editingId: string | null;
  form: CategoryFormData;
  parents: Category[];
  onFormChange: (next: CategoryFormData) => void;
  onClose: () => void;
  onSave: () => void;
}

export default function CategoryModal({ open, editingId, form, parents, onFormChange, onClose, onSave }: Props) {
  const dialogRef = useModalA11y(open, onClose);

  if (!open) return null;

  const patch = (p: Partial<CategoryFormData>) => onFormChange({ ...form, ...p });

  return (
    <div
      className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="category-modal-title"
        className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-[#e5e7eb] bg-[#fafbfc]">
          <h3 id="category-modal-title" className="text-[14px] font-bold text-[#1f2937]">{editingId ? '카테고리 수정' : '카테고리 추가'}</h3>
          <button onClick={onClose} aria-label="닫기" className="text-[#9ca3af] hover:text-[#1f2937] p-1 rounded hover:bg-[#f3f4f6] transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-6 space-y-5">
          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">분류</label>
            <select
              value={form.parent_id}
              onChange={e => patch({ parent_id: e.target.value })}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
            >
              <option value="">최상위 카테고리</option>
              {parents.filter(p => p.id !== editingId).map(p => (
                <option key={p.id} value={p.id}>↳ {p.name.kr || p.slug} 의 서브카테고리</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">슬러그 (URL용, 영문)</label>
            <input
              type="text"
              value={form.slug}
              onChange={e => patch({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
              placeholder="예: serum, cream, pdrn"
              className="w-full rounded-lg px-3 py-2.5 text-sm"
            />
          </div>

          <div>
            <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">카테고리명 (다국어)</label>
            <div className="grid grid-cols-2 gap-3">
              {SUPPORTED_LANGS.map(l => (
                <div key={l}>
                  <label className="block text-[10px] text-[#9ca3af] mb-1">{LANG_LABELS[l]}{l === 'kr' && ' *'}</label>
                  <input
                    type="text"
                    value={form.name[l] || ''}
                    onChange={e => patch({ name: { ...form.name, [l]: e.target.value } })}
                    placeholder={l === 'kr' ? '필수' : '선택'}
                    className="w-full rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">정렬 순서</label>
              <input
                type="number"
                value={form.sort_order}
                onChange={e => patch({ sort_order: Number(e.target.value) })}
                className="w-full rounded-lg px-3 py-2.5 text-sm"
              />
            </div>
            <div className="flex items-end pb-1">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={e => patch({ is_active: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                <span className="text-sm text-[#374151]">활성화</span>
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
