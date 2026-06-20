'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import SortableList from '@/components/admin/SortableList';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/Toast';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

const supabase = getSupabaseBrowser();
import {
  EMPTY_RETAILER,
  uploadWorldwideAsset,
  type RetailerRow as RetailerRowData,
} from '../_lib';
import RetailerRow from './RetailerRow';

interface Props {
  initialRetailers: RetailerRowData[];
}

/**
 * /admin/worldwide retailers tab — owns the list state + DB handlers and
 * delegates each row's UI to RetailerRow. The split was pulled out at
 * 2026-06-20 when the file hit 479 LOC; everything below ~200 LOC here is
 * the row card, which now lives in RetailerRow.tsx (props in, callbacks
 * out — same pattern as products/_components/ProductList).
 */
export default function RetailersEditor({ initialRetailers }: Props) {
  const confirm = useConfirm();
  const toast = useToast();
  const [retailers, setRetailers] = useState<RetailerRowData[]>(initialRetailers);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  function updateRetailer(index: number, patch: Partial<RetailerRowData>) {
    setRetailers(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRetailer() {
    const nextSort =
      retailers.length > 0 ? Math.max(...retailers.map(r => r.sort_order)) + 10 : 10;
    setRetailers(prev => [...prev, { ...EMPTY_RETAILER, sort_order: nextSort }]);
  }

  async function saveRetailer(index: number) {
    if (!supabase) {
      toast.show('Supabase가 설정되지 않았습니다.', 'error');
      return;
    }
    const r = retailers[index];
    if (!r.country_code || !r.country_native || !r.country_en) {
      toast.show('국가 코드, 원어명, 영문명은 필수입니다.', 'warning');
      return;
    }
    setSavingKey(`retailer-${index}`);
    const code = r.country_code.toLowerCase().trim();
    const payload = {
      country_code: code,
      country_native: r.country_native,
      country_en: r.country_en,
      region: r.region,
      store_name: r.store_name,
      store_url: r.store_url || '#',
      store_logo_url: r.store_logo_url || '',
      country_image_url: r.country_image_url || '',
      banner_color: r.banner_color || '#111111',
      is_active: r.is_active,
      sort_order: r.sort_order,
      updated_at: new Date().toISOString(),
    };
    const res = r.id
      ? await supabase.from('worldwide_retailers').update(payload).eq('id', r.id).select().single()
      : await supabase.from('worldwide_retailers').insert(payload).select().single();
    if (res.error) {
      setSavingKey(null);
      toast.show(`저장 실패: ${res.error.message}`, 'error');
      return;
    }
    if (res.data) updateRetailer(index, { id: (res.data as RetailerRowData).id });

    // country_image_url + banner_color sync across rows of the same country_code
    if (code) {
      await supabase
        .from('worldwide_retailers')
        .update({
          country_image_url: r.country_image_url || '',
          banner_color: r.banner_color || '#111111',
        })
        .eq('country_code', code);
      setRetailers(prev =>
        prev.map(row =>
          row.country_code.toLowerCase() === code
            ? {
                ...row,
                country_image_url: r.country_image_url || '',
                banner_color: r.banner_color || '#111111',
              }
            : row,
        ),
      );
    }

    setSavingKey(null);
    setSavedKey(`retailer-${index}`);
    setTimeout(() => setSavedKey(null), 1500);
  }

  async function handleFileUpload(
    index: number,
    file: File,
    field: 'store_logo_url' | 'country_image_url',
  ) {
    setSavingKey(`upload-${index}-${field}`);
    try {
      const url = await uploadWorldwideAsset(
        file,
        field === 'store_logo_url' ? 'vendor-logo' : 'country-image',
      );
      updateRetailer(index, { [field]: url });
      if (field === 'country_image_url') {
        const code = retailers[index].country_code.toLowerCase().trim();
        if (code) {
          setRetailers(prev =>
            prev.map(row =>
              row.country_code.toLowerCase() === code ? { ...row, country_image_url: url } : row,
            ),
          );
        }
      }
    } catch (err) {
      console.error(err);
      toast.show('이미지 업로드 실패. Supabase Storage 설정을 확인하세요.', 'error');
    } finally {
      setSavingKey(null);
    }
  }

  function addVendorForCountry(sourceIndex: number) {
    const src = retailers[sourceIndex];
    const nextSort = (src.sort_order || 0) + 1;
    const newRow: RetailerRowData = {
      ...EMPTY_RETAILER,
      country_code: src.country_code,
      country_native: src.country_native,
      country_en: src.country_en,
      region: src.region,
      banner_color: src.banner_color,
      country_image_url: src.country_image_url,
      store_name: '',
      store_url: '#',
      store_logo_url: '',
      sort_order: nextSort,
    };
    setRetailers(prev => {
      const next = [...prev];
      next.splice(sourceIndex + 1, 0, newRow);
      return next;
    });
  }

  async function deleteRetailer(index: number) {
    const r = retailers[index];
    const ok = await confirm({
      message: `${r.country_en} 을(를) 삭제하시겠습니까?`,
      tone: 'danger',
      confirmText: '삭제',
    });
    if (!ok) return;
    if (r.id && supabase) {
      const { error } = await supabase.from('worldwide_retailers').delete().eq('id', r.id);
      if (error) {
        toast.show(`삭제 실패: ${error.message}`, 'error');
        return;
      }
    }
    setRetailers(prev => prev.filter((_, i) => i !== index));
  }

  /** dnd id helper. Saved rows use the DB id; unsaved rows fall back to
   *  country_code + array index, which is stable for the brief window
   *  between "click add" and "click save". */
  function retailerDndId(r: RetailerRowData, index: number): string {
    return r.id !== null ? `id-${r.id}` : `new-${r.country_code || 'empty'}-${index}`;
  }

  async function handleReorder(next: RetailerRowData[]) {
    // Renumber by 10s so future manual sort_order edits don't immediately
    // need another full renumber.
    const renumbered = next.map((r, i) => ({ ...r, sort_order: (i + 1) * 10 }));
    setRetailers(renumbered);
    if (!supabase) return;
    try {
      await Promise.all(
        renumbered
          .filter(r => r.id !== null)
          .map(r =>
            supabase.from('worldwide_retailers').update({ sort_order: r.sort_order }).eq('id', r.id!),
          ),
      );
    } catch (err) {
      console.error('[admin/worldwide] reorder persist failed:', err);
    }
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
