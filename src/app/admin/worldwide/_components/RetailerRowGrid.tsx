'use client';

import { REGION_ORDER, type Region } from '@/lib/worldwide/defaults';
import type { RetailerRow as RetailerRowData } from '../_lib';
import { Field, FileUpload } from './RetailerFormParts';

interface Props {
  r: RetailerRowData;
  isUploadingLogo: boolean;
  isUploadingCountry: boolean;
  onUpdate: (patch: Partial<RetailerRowData>) => void;
  onUpload: (file: File, field: 'store_logo_url' | 'country_image_url') => void;
}

/**
 * The 4-column form grid inside a retailer row — country code / native /
 * en / region on the first two rows, then store name + store URL, then
 * the two file pickers (vendor logo + country image), then banner color +
 * sort order + 공개 toggle. Pure UI; parent owns the row state and
 * routes patches via onUpdate.
 */
export default function RetailerRowGrid({
  r,
  isUploadingLogo,
  isUploadingCountry,
  onUpdate,
  onUpload,
}: Props) {
  return (
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
  );
}
