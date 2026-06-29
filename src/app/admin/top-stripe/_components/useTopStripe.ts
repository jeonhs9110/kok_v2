import { useEffect, useState } from 'react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import { useIsDirty } from '@/hooks/useIsDirty';

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
 * State + load/save handlers for /admin/top-stripe. Reads + writes go
 * through /api/admin/site-settings (dispatcher-gated). The stripe data
 * lives as a singleton site_settings row keyed 'top_stripe' with a JSON
 * value.
 */
export function useTopStripe() {
  const toast = useToast();
  const [data, setData] = useState<TopStripe>(DEFAULT);
  const [saved, setSaved] = useState<TopStripe>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/site-settings?keys=top_stripe', { cache: 'no-store' });
        if (res.ok) {
          const json = (await res.json()) as { values?: Record<string, unknown> };
          const raw = json.values?.top_stripe;
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const merged = { ...DEFAULT, ...(parsed as Partial<TopStripe>) };
            setData(merged);
            setSaved(merged);
          }
        }
      } catch (err) {
        console.error('[admin/top-stripe] load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isDirty = useIsDirty(data, saved);

  // Live preview broadcast — mirrors useSubHero / useSlideLivePreview.
  // Posts the in-flight stripe values to the parent hub which forwards
  // them to the central storefront iframe. No-op for non-embedded use.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    const handle = requestAnimationFrame(() => {
      try {
        window.parent.postMessage(
          { type: 'kokkok-builder-topstripe-preview', override: data },
          window.location.origin,
        );
      } catch { /* best-effort */ }
    });
    return () => cancelAnimationFrame(handle);
  }, [data]);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined' || window.parent === window) return;
      try {
        window.parent.postMessage(
          { type: 'kokkok-builder-topstripe-preview', override: null },
          window.location.origin,
        );
      } catch { /* ignore */ }
    };
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ key: 'top_stripe', value: JSON.stringify(data) }] }),
      });
      if (!res.ok) throw new Error('http_' + res.status);
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
