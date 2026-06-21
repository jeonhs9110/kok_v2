'use client';

import type { Category } from '@/lib/api/categories';

interface BasicFieldsValue {
  name: string;
  ingredient: string;
  summary: string;
  categoryId: string;
  subcategoryId: string;
  description: string;
}

interface Props {
  value: BasicFieldsValue;
  categories: Category[];
  onChange: (patch: Partial<BasicFieldsValue>) => void;
}

/**
 * The non-image, non-price block of the product modal: name, ingredient tag,
 * category + subcategory selects, summary, and the long description textarea.
 * Pure UI — parent owns the full FormState and routes patches back through
 * the onChange callback so we don't duplicate the form-state shape.
 */
export default function ProductBasicFields({ value, categories, onChange }: Props) {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">상품명 *</label>
          <input
            required
            type="text"
            value={value.name}
            onChange={e => onChange({ name: e.target.value })}
            className="w-full p-2 text-sm rounded"
            placeholder="예: 레티놀 바운스 세럼"
          />
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">성분 태그</label>
          <input
            type="text"
            value={value.ingredient}
            onChange={e => onChange({ ingredient: e.target.value })}
            className="w-full p-2 text-sm rounded"
            placeholder="예: CICA"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">카테고리</label>
          <select
            value={value.categoryId}
            onChange={e => onChange({ categoryId: e.target.value, subcategoryId: '' })}
            className="w-full p-2 text-sm rounded bg-white"
          >
            <option value="">선택 안 함</option>
            {categories.filter(c => !c.parent_id).map(c => (
              <option key={c.id} value={c.id}>{c.name?.kr || c.slug}</option>
            ))}
          </select>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">서브카테고리</label>
          <select
            value={value.subcategoryId}
            onChange={e => onChange({ subcategoryId: e.target.value })}
            disabled={!value.categoryId}
            className="w-full p-2 text-sm rounded bg-white disabled:opacity-40"
          >
            <option value="">선택 안 함</option>
            {categories.filter(c => c.parent_id === value.categoryId).map(c => (
              <option key={c.id} value={c.id}>{c.name?.kr || c.slug}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">한 줄 요약 *</label>
        <input
          required
          type="text"
          value={value.summary}
          onChange={e => onChange({ summary: e.target.value })}
          className="w-full p-2 text-sm rounded"
          placeholder="끈적임없이 촉촉한 기능성 세럼"
        />
      </div>

      <div className="space-y-1">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">한 줄 설명</label>
        <textarea
          rows={3}
          value={value.description}
          onChange={e => onChange({ description: e.target.value })}
          className="w-full p-2 text-sm rounded resize-none"
          placeholder="상품의 주요 특징과 성분을 설명해주세요..."
        />
      </div>
    </>
  );
}
