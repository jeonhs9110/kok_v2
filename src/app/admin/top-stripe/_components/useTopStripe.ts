import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';

const supabase = getSupabaseBrowser();

export interface TopStripe {
  is_active: boolean;
  text: string;
  link_url: string;
  bg_color: string;
  text_color: string;
}

const DEFAULT: TopStripe = {
  is_active: false,
  text: '',
  link_url: '',
  bg_color: '#1f2937',
  text_color: '#ffffff',
};

/**
 * State + load/save handlers for /admin/top-stripe. The stripe data
 * lives as a singleton site_settings row keyed 'top_stripe' with a JSON
 * value; this hook handles the load → setData/setSaved pair and the
 * upsert-on-save with cache eviction.
 */
export function useTopStripe() {
  const toast = useToast();
  const [data, setData] = useState<TopStripe>(DEFAULT);
  const [saved, setSaved] = useState<TopStripe>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      const { data: row } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'top_stripe')
        .maybeSingle();
      if (row?.value) {
        try {
          const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          const merged = { ...DEFAULT, ...parsed };
          setData(merged);
          setSaved(merged);
        } catch { /* keep defaults */ }
      }
      setLoading(false);
    })().catch(err => {
      console.error('[admin/top-stripe] load failed:', err);
      setLoading(false);
    });
  }, []);

  const isDirty = JSON.stringify(data) !== JSON.stringify(saved);

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          { key: 'top_stripe', value: JSON.stringify(data), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
      setSaved(data);
      revalidateHomepageData('top_stripe');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      console.error('[admin/top-stripe] save failed:', err);
      toast.show(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      setSaving(false);
    }
  }

  return { data, setData, loading, saving, savedFlash, isDirty, handleSave };
}
