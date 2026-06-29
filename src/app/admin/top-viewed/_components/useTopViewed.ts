import { useEffect, useState } from 'react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import { useIsDirty } from '@/hooks/useIsDirty';

export interface TopViewedConfig {
  is_active: boolean;
  title_kr: string;
  title_en: string;
  subtitle_kr: string;
  subtitle_en: string;
  window_days: number;
  top_n: number;
}

export const DEFAULT_TOP_VIEWED: TopViewedConfig = {
  is_active: true,
  title_kr: '지금 가장 많이 본 상품',
  title_en: 'TRENDING NOW',
  subtitle_kr: '최근 7일 인기',
  subtitle_en: 'Last 7 days',
  window_days: 7,
  top_n: 8,
};

/**
 * State + load/save handlers for /admin/top-viewed. The "지금 가장 많이
 * 본 상품" section was data-driven (hardcoded title/subtitle, fixed
 * window + count) with no editor at all — surfaced by the homepage
 * builder audit on 2026-06-29. This hook restores operator control:
 * stored as a singleton site_settings row keyed 'top_viewed_config'
 * with a JSON value.
 *
 * Window / count changes require a server-side re-query of the analytics
 * data — handled by getTopViewedProducts() reading the same config.
 * Title / subtitle changes are pure presentation and get a live preview
 * broadcast (kokkok-builder-topviewed-preview).
 */
export function useTopViewed() {
  const toast = useToast();
  const [data, setData] = useState<TopViewedConfig>(DEFAULT_TOP_VIEWED);
  const [saved, setSaved] = useState<TopViewedConfig>(DEFAULT_TOP_VIEWED);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/site-settings?keys=top_viewed_config', { cache: 'no-store' });
        if (res.ok) {
          const json = (await res.json()) as { values?: Record<string, unknown> };
          const raw = json.values?.top_viewed_config;
          if (raw) {
            const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
            const merged = { ...DEFAULT_TOP_VIEWED, ...(parsed as Partial<TopViewedConfig>) };
            setData(merged);
            setSaved(merged);
          }
        }
      } catch (err) {
        console.error('[admin/top-viewed] load failed:', err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const isDirty = useIsDirty(data, saved);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ key: 'top_viewed_config', value: JSON.stringify(data) }] }),
      });
      if (!res.ok) throw new Error('http_' + res.status);
      setSaved(data);
      revalidateHomepageData('top_viewed_config');
      // Window / count changes invalidate the analytics-derived product
      // list — evict that tag too so the next render re-queries with the
      // new bounds instead of returning the stale 5-min cached set.
      revalidateHomepageData('analytics');
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
      toast.show('인기 상품 섹션 설정이 저장되었습니다.', 'success');
    } catch (err) {
      console.error('[admin/top-viewed] save failed:', err);
      toast.show(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Live preview broadcast — title/subtitle changes overlay the rendered
  // section in real time. Window / count changes are not broadcast because
  // changing them would require a server re-query of the analytics data;
  // those are reflected on the iframe remount after save instead.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    const handle = requestAnimationFrame(() => {
      try {
        window.parent.postMessage(
          {
            type: 'kokkok-builder-topviewed-preview',
            override: {
              is_active: data.is_active,
              title_kr: data.title_kr,
              title_en: data.title_en,
              subtitle_kr: data.subtitle_kr,
              subtitle_en: data.subtitle_en,
            },
          },
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
          { type: 'kokkok-builder-topviewed-preview', override: null },
          window.location.origin,
        );
      } catch { /* ignore */ }
    };
  }, []);

  return { data, setData, loading, saving, savedFlash, isDirty, handleSave };
}
