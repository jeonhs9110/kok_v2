'use client';

import { useState } from 'react';
import { Save, Plus, Trash2, GripVertical } from 'lucide-react';
import SortableList from '@/components/admin/SortableList';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

const supabase = getSupabaseBrowser();
import { REGION_ORDER, type Region } from '@/lib/worldwide/defaults';
import {
  EMPTY_RETAILER,
  uploadWorldwideAsset,
  type RetailerRow,
} from '../_lib';

interface Props {
  initialRetailers: RetailerRow[];
}

export default function RetailersEditor({ initialRetailers }: Props) {
  const confirm = useConfirm();
  const [retailers, setRetailers] = useState<RetailerRow[]>(initialRetailers);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKey, setSavedKey] = useState<string | null>(null);

  function updateRetailer(index: number, patch: Partial<RetailerRow>) {
    setRetailers(prev => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRetailer() {
    const nextSort =
      retailers.length > 0 ? Math.max(...retailers.map(r => r.sort_order)) + 10 : 10;
    setRetailers(prev => [...prev, { ...EMPTY_RETAILER, sort_order: nextSort }]);
  }

  async function saveRetailer(index: number) {
    if (!supabase) {
      alert('Supabase가 설정되지 않았습니다.');
      return;
    }
    const r = retailers[index];
    if (!r.country_code || !r.country_native || !r.country_en) {
      alert('국가 코드, 원어명, 영문명은 필수입니다.');
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
      alert(`저장 실패: ${res.error.message}`);
      return;
    }
    if (res.data) updateRetailer(index, { id: (res.data as RetailerRow).id });

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
    const prefix = field === 'store_logo_url' ? 'vendor-logo' : 'country-image';
    setSavingKey(`upload-${index}-${field}`);
    try {
      const url = await uploadWorldwideAsset(file, prefix);
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
      alert('이미지 업로드 실패. Supabase Storage 설정을 확인하세요.');
    } finally {
      setSavingKey(null);
    }
  }

  function addVendorForCountry(sourceIndex: number) {
    const src = retailers[sourceIndex];
    const nextSort = (src.sort_order || 0) + 1;
    const newRow: RetailerRow = {
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
    const ok = await confirm({ message: `${r.country_en} 을(를) 삭제하시겠습니까?`, tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    if (r.id && supabase) {
      const { error } = await supabase.from('worldwide_retailers').delete().eq('id', r.id);
      if (error) {
        alert(`삭제 실패: ${error.message}`);
        return;
      }
    }
    setRetailers(prev => prev.filter((_, i) => i !== index));
  }

  // dnd id helper. Saved rows use the numeric DB id; unsaved rows fall
  // back to country_code + array index, which is stable enough for the
  // brief window between "click add" and "click save". Two brand-new
  // rows with empty country_code collide, but they can't be saved without
  // one anyway, so the collision never lands on a persisted row.
  function retailerDndId(r: RetailerRow, index: number): string {
    return r.id !== null ? `id-${r.id}` : `new-${r.country_code || 'empty'}-${index}`;
  }

  async function handleReorder(next: RetailerRow[]) {
    // Renumber by 10s — leaves room for manual sort_order edits in the
    // detail form without immediately requiring another full renumber.
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800 space-y-1.5">
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
        className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white rounded-lg text-sm font-semibold hover:bg-[#2563eb] transition"
      >
        <Plus className="w-4 h-4" /> 새 국가 추가
      </button>

      <SortableList
        items={retailers.map((r, index) => ({ ...r, _dndId: retailerDndId(r, index) }))}
        getId={(r) => r._dndId}
        onReorder={(next) => handleReorder(next.map(({ _dndId, ...rest }) => { void _dndId; return rest; }))}
        className="space-y-3"
      >
        {(r, { dragHandleProps }) => {
          const index = retailers.findIndex(x => retailerDndId(x, retailers.indexOf(x)) === r._dndId);
          return (
        <div
          className="bg-white rounded-xl border border-gray-200 p-4 space-y-3"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                type="button"
                {...dragHandleProps}
                className={`${dragHandleProps.className ?? ''} text-gray-300 hover:text-gray-600 p-1`}
                aria-label="드래그하여 순서 변경"
              >
                <GripVertical className="w-5 h-5" />
              </button>
              <div
                className="w-8 h-8 rounded-full border border-gray-200"
                style={{ backgroundColor: r.banner_color }}
              />
              <div>
                <p className="text-sm font-bold">{r.country_en || '(새 국가)'}</p>
                <p className="text-xs text-gray-500">{r.country_native}</p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => deleteRetailer(index)}
                className="p-1.5 rounded hover:bg-red-50 text-red-500"
                title="삭제"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">국가 코드 (ISO)</label>
              <input
                type="text"
                value={r.country_code}
                onChange={e =>
                  updateRetailer(index, { country_code: e.target.value.toLowerCase() })
                }
                placeholder="kr"
                maxLength={2}
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">원어명</label>
              <input
                type="text"
                value={r.country_native}
                onChange={e => updateRetailer(index, { country_native: e.target.value })}
                placeholder="한국"
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">영문명</label>
              <input
                type="text"
                value={r.country_en}
                onChange={e => updateRetailer(index, { country_en: e.target.value })}
                placeholder="South Korea"
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">지역</label>
              <select
                value={r.region}
                onChange={e => updateRetailer(index, { region: e.target.value as Region })}
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 bg-white"
              >
                {REGION_ORDER.map(reg => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase">스토어 이름</label>
              <input
                type="text"
                value={r.store_name}
                onChange={e => updateRetailer(index, { store_name: e.target.value })}
                placeholder="Kokkok Garden Korea"
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase">
                스토어 URL (# = 준비중)
              </label>
              <input
                type="text"
                value={r.store_url}
                onChange={e => updateRetailer(index, { store_url: e.target.value })}
                placeholder="https://..."
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono"
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase">
                스토어 로고 (벤더 로고)
              </label>
              <div className="flex gap-2 mt-1 items-center">
                {r.store_logo_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.store_logo_url}
                    alt=""
                    className="w-12 h-12 object-contain bg-white rounded border border-gray-200"
                  />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(index, f, 'store_logo_url');
                  }}
                  className="flex-1 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                {r.store_logo_url && (
                  <button
                    type="button"
                    onClick={() => updateRetailer(index, { store_logo_url: '' })}
                    className="text-xs text-red-500 hover:underline px-2"
                  >
                    제거
                  </button>
                )}
              </div>
              {savingKey === `upload-${index}-store_logo_url` && (
                <p className="text-[10px] text-blue-500 mt-1">업로드 중...</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="text-[10px] font-bold text-gray-500 uppercase">
                국가 이미지 (같은 국가코드의 모든 벤더에 공통 적용)
              </label>
              <div className="flex gap-2 mt-1 items-center">
                {r.country_image_url && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={r.country_image_url}
                    alt=""
                    className="w-20 h-12 object-cover rounded border border-gray-200"
                  />
                )}
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileUpload(index, f, 'country_image_url');
                  }}
                  className="flex-1 text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                {r.country_image_url && (
                  <button
                    type="button"
                    onClick={() => updateRetailer(index, { country_image_url: '' })}
                    className="text-xs text-red-500 hover:underline px-2"
                  >
                    제거
                  </button>
                )}
              </div>
              {savingKey === `upload-${index}-country_image_url` && (
                <p className="text-[10px] text-blue-500 mt-1">업로드 중...</p>
              )}
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">배너 색상</label>
              <div className="flex gap-2 mt-1">
                <input
                  type="color"
                  value={r.banner_color || '#111111'}
                  onChange={e => updateRetailer(index, { banner_color: e.target.value })}
                  className="w-10 h-10 border border-gray-200 rounded cursor-pointer"
                />
                <input
                  type="text"
                  value={r.banner_color}
                  onChange={e => updateRetailer(index, { banner_color: e.target.value })}
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono"
                />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">정렬 순서</label>
              <input
                type="number"
                value={r.sort_order}
                onChange={e =>
                  updateRetailer(index, { sort_order: Number(e.target.value) || 0 })
                }
                className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={r.is_active}
                  onChange={e => updateRetailer(index, { is_active: e.target.checked })}
                  className="w-4 h-4 rounded"
                />
                공개
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2 border-t border-gray-100 flex-wrap">
            <button
              onClick={() => saveRetailer(index)}
              disabled={savingKey === `retailer-${index}`}
              className={`px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${
                savedKey === `retailer-${index}`
                  ? 'bg-green-500 text-white'
                  : 'bg-[#3b82f6] text-white hover:bg-[#2563eb]'
              } disabled:opacity-50`}
            >
              <Save className="w-4 h-4" />
              {savingKey === `retailer-${index}`
                ? '저장 중...'
                : savedKey === `retailer-${index}`
                ? '✓ 저장 완료'
                : r.id
                ? '저장'
                : '추가'}
            </button>
            <button
              type="button"
              onClick={() => addVendorForCountry(index)}
              disabled={!r.country_code}
              className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-semibold hover:bg-gray-50 flex items-center gap-2 disabled:opacity-40"
              title="같은 국가에 다른 벤더 추가 (예: 중국 → Taobao, Shopee, Tmall)"
            >
              <Plus className="w-4 h-4" /> 이 국가에 벤더 추가
            </button>
            <span className="text-xs text-gray-400">{r.id ? `ID: ${r.id}` : '저장되지 않음'}</span>
          </div>
        </div>
          );
        }}
      </SortableList>
    </div>
  );
}
