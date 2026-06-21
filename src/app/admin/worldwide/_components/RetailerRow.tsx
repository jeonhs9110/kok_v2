'use client';

import { Save, Plus, Trash2, GripVertical } from 'lucide-react';
import type { RetailerRow as RetailerRowData } from '../_lib';
import RetailerRowGrid from './RetailerRowGrid';

interface DragHandleProps {
  className?: string;
  [key: string]: unknown;
}

interface Props {
  r: RetailerRowData;
  index: number;
  dragHandleProps: DragHandleProps;
  savingKey: string | null;
  savedKey: string | null;
  onUpdate: (patch: Partial<RetailerRowData>) => void;
  onSave: () => void;
  onDelete: () => void;
  onAddVendor: () => void;
  onUpload: (file: File, field: 'store_logo_url' | 'country_image_url') => void;
}

/**
 * One retailer card. Header (drag handle + color chip + country name +
 * delete) → RetailerRowGrid (4-col form) → footer (save + add vendor).
 * Pure UI; the useRetailers hook owns every callback this row needs.
 */
export default function RetailerRow({
  r,
  index,
  dragHandleProps,
  savingKey,
  savedKey,
  onUpdate,
  onSave,
  onDelete,
  onAddVendor,
  onUpload,
}: Props) {
  const isSaving = savingKey === `retailer-${index}`;
  const isSaved = savedKey === `retailer-${index}`;
  const isUploadingLogo = savingKey === `upload-${index}-store_logo_url`;
  const isUploadingCountry = savingKey === `upload-${index}-country_image_url`;

  return (
    <div className="bg-white rounded border border-[#e5e7eb] p-4 space-y-3">
      {/* Header row — drag handle + color chip + country name + delete */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            {...dragHandleProps}
            className={`${dragHandleProps.className ?? ''} text-[#d1d5db] hover:text-[#6b7280] p-1`}
            aria-label="드래그하여 순서 변경"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          <div
            className="w-8 h-8 rounded-full border border-[#e5e7eb]"
            style={{ backgroundColor: r.banner_color }}
          />
          <div>
            <p className="text-sm font-bold text-[#1f2937]">{r.country_en || '(새 국가)'}</p>
            <p className="text-xs text-[#6b7280]">{r.country_native}</p>
          </div>
        </div>
        <button
          onClick={onDelete}
          className="p-1.5 rounded hover:bg-[#fef2f2] text-[#ef4444]"
          title="삭제"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      <RetailerRowGrid
        r={r}
        isUploadingLogo={isUploadingLogo}
        isUploadingCountry={isUploadingCountry}
        onUpdate={onUpdate}
        onUpload={onUpload}
      />

      {/* Footer — save + add-vendor */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#f3f4f6] flex-wrap">
        <button
          onClick={onSave}
          disabled={isSaving}
          className={`px-5 py-2 rounded font-semibold text-sm flex items-center gap-2 transition ${
            isSaved
              ? 'bg-[#22c55e] text-white'
              : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
          } disabled:opacity-50`}
        >
          <Save className="w-4 h-4" />
          {isSaving ? '저장 중...' : isSaved ? '✓ 저장 완료' : r.id ? '저장' : '추가'}
        </button>
        <button
          type="button"
          onClick={onAddVendor}
          disabled={!r.country_code}
          className="px-4 py-2 border border-[#d1d5db] rounded text-sm font-semibold text-[#374151] bg-white hover:bg-[#f9fafb] flex items-center gap-2 disabled:opacity-40 transition-colors kokkok-keep-border"
          title="같은 국가에 다른 벤더 추가 (예: 중국 → Taobao, Shopee, Tmall)"
        >
          <Plus className="w-4 h-4" /> 이 국가에 벤더 추가
        </button>
        <span className="text-xs text-[#9ca3af]">{r.id ? `ID: ${r.id}` : '저장되지 않음'}</span>
      </div>
    </div>
  );
}
