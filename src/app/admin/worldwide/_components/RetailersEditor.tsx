'use client';

import { Plus } from 'lucide-react';
import SortableList from '@/components/admin/SortableList';
import type { RetailerRow as RetailerRowData } from '../_lib';
import RetailerRow from './RetailerRow';
import { useRetailers } from './useRetailers';

interface Props {
  initialRetailers: RetailerRowData[];
}

/**
 * /admin/worldwide retailers tab. Pure render — every handler lives in
 * the useRetailers hook. RetailerRow gets a props bag (state + the
 * callbacks the hook returns).
 */
export default function RetailersEditor({ initialRetailers }: Props) {
  const {
    retailers,
    savingKey,
    savedKey,
    updateRetailer,
    addRetailer,
    saveRetailer,
    handleFileUpload,
    addVendorForCountry,
    deleteRetailer,
    handleReorder,
  } = useRetailers(initialRetailers);

  /** dnd id helper. Saved rows use the DB id; unsaved rows fall back to
   *  country_code + array index, which is stable for the brief window
   *  between "click add" and "click save". */
  function retailerDndId(r: RetailerRowData, index: number): string {
    return r.id !== null ? `id-${r.id}` : `new-${r.country_code || 'empty'}-${index}`;
  }

  return (
    <div className="space-y-3">
      <div className="bg-[#eff6ff] border border-[#bfdbfe] rounded p-4 text-sm text-[#1e40af] space-y-1.5">
        <p className="font-semibold">💡 한 국가에 여러 벤더를 등록할 수 있습니다</p>
        <p>
          같은 <code className="bg-white px-1 rounded">국가 코드</code>를 가진 여러 행을 만들면
          프론트에서 해당 국가 카드를 누를 때 벤더 목록이 함께 노출됩니다. (예: 중국 → Taobao,
          Shopee, Tmall)
        </p>
        <p>
          <strong>국가 이미지</strong>는 같은 국가 코드의 모든 벤더 행에 자동 동기화됩니다.{' '}
          <strong>스토어 로고</strong>는 벤더별로 개별 설정됩니다.
        </p>
      </div>
      <button
        onClick={addRetailer}
        className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white rounded text-sm font-semibold hover:bg-[#2563eb] transition"
      >
        <Plus className="w-4 h-4" /> 새 국가 추가
      </button>

      <SortableList
        items={retailers.map((r, index) => ({ ...r, _dndId: retailerDndId(r, index) }))}
        getId={r => r._dndId}
        onReorder={next =>
          handleReorder(
            next.map(({ _dndId, ...rest }) => {
              void _dndId;
              return rest;
            }),
          )
        }
        className="space-y-3"
      >
        {(r, { dragHandleProps }) => {
          const index = retailers.findIndex(
            x => retailerDndId(x, retailers.indexOf(x)) === r._dndId,
          );
          return (
            <RetailerRow
              r={r}
              index={index}
              dragHandleProps={dragHandleProps}
              savingKey={savingKey}
              savedKey={savedKey}
              onUpdate={patch => updateRetailer(index, patch)}
              onSave={() => saveRetailer(index)}
              onDelete={() => deleteRetailer(index)}
              onAddVendor={() => addVendorForCountry(index)}
              onUpload={(file, field) => handleFileUpload(index, file, field)}
            />
          );
        }}
      </SortableList>
    </div>
  );
}
