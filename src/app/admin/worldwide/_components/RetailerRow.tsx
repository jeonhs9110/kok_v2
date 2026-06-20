'use client';

import { Save, Plus, Trash2, GripVertical } from 'lucide-react';
import { REGION_ORDER, type Region } from '@/lib/worldwide/defaults';
import type { RetailerRow as RetailerRowData } from '../_lib';

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
 * One retailer card inside the worldwide editor. Pure props in / callbacks
 * out — extracted from RetailersEditor's 285-LOC inline render so the
 * parent only owns state + handlers, not the form chrome.
 *
 * Form chrome uses the Cafe24 input baseline (border-[#d1d5db] resting
 * + blue focus from globals.css) and the standard 11px semibold uppercase
 * label, matching every other admin form post-#187.
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

      {/* Form grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Field label="국가 코드 (ISO)">
          <input
            type="text"
            value={r.country_code}
            onChange={e => onUpdate({ country_code: e.target.value.toLowerCase() })}
            placeholder="kr"
            maxLength={2}
            className="w-full rounded px-3 py-2 text-sm font-mono"
          />
        </Field>
        <Field label="원어명">
          <input
            type="text"
            value={r.country_native}
            onChange={e => onUpdate({ country_native: e.target.value })}
            placeholder="한국"
            className="w-full rounded px-3 py-2 text-sm"
          />
        </Field>
        <Field label="영문명">
          <input
            type="text"
            value={r.country_en}
            onChange={e => onUpdate({ country_en: e.target.value })}
            placeholder="South Korea"
            className="w-full rounded px-3 py-2 text-sm"
          />
        </Field>
        <Field label="지역">
          <select
            value={r.region}
            onChange={e => onUpdate({ region: e.target.value as Region })}
            className="w-full rounded px-3 py-2 text-sm bg-white"
          >
            {REGION_ORDER.map(reg => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>
        </Field>
        <Field label="스토어 이름" className="md:col-span-2">
          <input
            type="text"
            value={r.store_name}
            onChange={e => onUpdate({ store_name: e.target.value })}
            placeholder="Kokkok Garden Korea"
            className="w-full rounded px-3 py-2 text-sm"
          />
        </Field>
        <Field label="스토어 URL (# = 준비중)" className="md:col-span-2">
          <input
            type="text"
            value={r.store_url}
            onChange={e => onUpdate({ store_url: e.target.value })}
            placeholder="https://..."
            className="w-full rounded px-3 py-2 text-sm font-mono"
          />
        </Field>

        <Field label="스토어 로고 (벤더 로고)" className="md:col-span-2">
          <FileUpload
            previewUrl={r.store_logo_url}
            previewClass="w-12 h-12 object-contain bg-white rounded border border-[#e5e7eb]"
            accept="image/png,image/jpeg,image/webp,image/svg+xml"
            onPick={file => onUpload(file, 'store_logo_url')}
            onClear={() => onUpdate({ store_logo_url: '' })}
            isUploading={isUploadingLogo}
          />
        </Field>

        <Field
          label="국가 이미지 (같은 국가코드의 모든 벤더에 공통 적용)"
          className="md:col-span-2"
        >
          <FileUpload
            previewUrl={r.country_image_url}
            previewClass="w-20 h-12 object-cover rounded border border-[#e5e7eb]"
            accept="image/png,image/jpeg,image/webp"
            onPick={file => onUpload(file, 'country_image_url')}
            onClear={() => onUpdate({ country_image_url: '' })}
            isUploading={isUploadingCountry}
          />
        </Field>

        <Field label="배너 색상">
          <div className="flex gap-2">
            <input
              type="color"
              value={r.banner_color || '#111111'}
              onChange={e => onUpdate({ banner_color: e.target.value })}
              className="w-10 h-10 border border-[#d1d5db] rounded cursor-pointer kokkok-keep-border"
            />
            <input
              type="text"
              value={r.banner_color}
              onChange={e => onUpdate({ banner_color: e.target.value })}
              className="flex-1 rounded px-3 py-2 text-sm font-mono"
            />
          </div>
        </Field>

        <Field label="정렬 순서">
          <input
            type="number"
            value={r.sort_order}
            onChange={e => onUpdate({ sort_order: Number(e.target.value) || 0 })}
            className="w-full rounded px-3 py-2 text-sm"
          />
        </Field>

        <div className="flex items-end">
          <label className="flex items-center gap-2 text-sm cursor-pointer text-[#1f2937]">
            <input
              type="checkbox"
              checked={r.is_active}
              onChange={e => onUpdate({ is_active: e.target.checked })}
              className="w-4 h-4 rounded"
            />
            공개
          </label>
        </div>
      </div>

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
          className="px-4 py-2 border border-[#d1d5db] rounded text-sm font-semibold text-[#374151] bg-white hover:bg-[#f9fafb] flex items-center gap-2 disabled:opacity-40 transition-colors"
          title="같은 국가에 다른 벤더 추가 (예: 중국 → Taobao, Shopee, Tmall)"
        >
          <Plus className="w-4 h-4" /> 이 국가에 벤더 추가
        </button>
        <span className="text-xs text-[#9ca3af]">{r.id ? `ID: ${r.id}` : '저장되지 않음'}</span>
      </div>
    </div>
  );
}

/** Cafe24 form field with the standard 11px semibold uppercase label. */
function Field({
  label,
  className = '',
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={className}>
      <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider block mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

/** Compact file-picker row used by both store-logo + country-image fields. */
function FileUpload({
  previewUrl,
  previewClass,
  accept,
  onPick,
  onClear,
  isUploading,
}: {
  previewUrl: string;
  previewClass: string;
  accept: string;
  onPick: (file: File) => void;
  onClear: () => void;
  isUploading: boolean;
}) {
  return (
    <>
      <div className="flex gap-2 items-center">
        {previewUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={previewUrl} alt="" className={previewClass} />
        )}
        <input
          type="file"
          accept={accept}
          onChange={e => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
          }}
          className="flex-1 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#f3f4f6] file:text-[#374151] hover:file:bg-[#e5e7eb]"
        />
        {previewUrl && (
          <button
            type="button"
            onClick={onClear}
            className="text-xs text-[#ef4444] hover:underline px-2"
          >
            제거
          </button>
        )}
      </div>
      {isUploading && (
        <p className="text-[10px] text-[#3b82f6] mt-1">업로드 중...</p>
      )}
    </>
  );
}
