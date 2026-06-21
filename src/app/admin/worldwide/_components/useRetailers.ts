import { useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { EMPTY_RETAILER, uploadWorldwideAsset, type RetailerRow } from '../_lib';

const supabase = getSupabaseBrowser();

/**
 * State + DB handlers for /admin/worldwide. Owns the retailer list,
 * per-row save/upload progress, add/delete/save/reorder/file-upload
 * handlers, and the "add another vendor for the same country" branch.
 * Country-image + banner-color sync across all rows of the same
 * country_code lives here too.
 *
 * Returned bag wires straight into RetailersEditor's render: the parent
 * is now pure UI (sort hint card, add button, SortableList rendering
 * RetailerRow with these callbacks).
 */
export function useRetailers(initialRetailers: RetailerRow[]) {
  const confirm = useConfirm();
  const toast = useToast();
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

  async function handleReorder(next: RetailerRow[]) {
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

  return {
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
  };
}
