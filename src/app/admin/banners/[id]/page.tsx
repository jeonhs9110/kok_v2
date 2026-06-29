'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import type { Lang } from '@/lib/i18n/types';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { LoadingState } from '@/components/admin/CafeWidgets';
import { USE_RDS_FROM_BROWSER } from '@/lib/admin/rdsFlag';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import BannerEditForm, { type BannerRow } from './_components/BannerEditForm';

const supabase = getSupabaseBrowser();

const DEFAULT: BannerRow = {
  text: {},
  link_url: '',
  bg_color: '#1f2937',
  text_color: '#ffffff',
  is_active: true,
};

/**
 * /admin/banners/[id] — edit one inline homepage banner. The row is
 * spawned by the + button on /admin/homepage; this page only handles
 * editing the row's content and deleting it. Placement (where the
 * banner sits in the homepage flow) is owned by the homepage builder's
 * drag-reorder — there is no order control on this form.
 */
export default function BannerEditPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const id = params?.id;

  const [data, setData] = useState<BannerRow>(DEFAULT);
  const [saved, setSaved] = useState<BannerRow>(DEFAULT);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [activeLang, setActiveLang] = useState<Lang>('kr');

  useEffect(() => {
    if (!id) { setLoading(false); return; }
    (async () => {
      let row: Record<string, unknown> | null = null;
      if (USE_RDS_FROM_BROWSER) {
        // The list route returns ALL active banners; filter to ours.
        const res = await fetch('/api/admin/homepage-banners', { cache: 'no-store' });
        if (res.ok) {
          const body = await res.json() as { rows: Record<string, unknown>[] };
          row = body.rows.find(r => r.id === id) ?? null;
        }
      } else if (supabase) {
        const r = await supabase
          .from('homepage_banners')
          .select('text,link_url,bg_color,text_color,is_active')
          .eq('id', id)
          .maybeSingle();
        row = (r.data as Record<string, unknown> | null) ?? null;
      }
      if (!row) { setLoading(false); return; }
      const next: BannerRow = {
        text: typeof row.text === 'object' && row.text !== null ? row.text as Record<string, string> : {},
        link_url: (row.link_url as string | null) || '',
        bg_color: (row.bg_color as string | null) || DEFAULT.bg_color,
        text_color: (row.text_color as string | null) || DEFAULT.text_color,
        is_active: (row.is_active as boolean | null) ?? true,
      };
      setData(next);
      setSaved(next);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setSaving(true);
    try {
      const payload = {
        text: data.text,
        link_url: data.link_url || null,
        bg_color: data.bg_color,
        text_color: data.text_color,
        is_active: data.is_active,
      };
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch(`/api/admin/homepage-banners?id=${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
      } else {
        if (!supabase) return;
        const { error } = await supabase.from('homepage_banners').update(payload).eq('id', id);
        if (error) throw error;
      }
      revalidateHomepageData('homepage_banners');
      setSaved(data);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      toast.show('띠배너가 저장되었습니다', 'success');
    } catch (err) {
      console.error('[admin/banners] save failed:', err);
      toast.show('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!id) return;
    const ok = await confirm({ message: '이 띠배너를 삭제할까요? 되돌릴 수 없습니다.', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    try {
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch(`/api/admin/homepage-banners?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`API ${res.status}`);
      } else {
        if (!supabase) return;
        const { error } = await supabase.from('homepage_banners').delete().eq('id', id);
        if (error) throw error;
      }
      // Best-effort: also strip the matching key from the section order
      // so the deleted banner never paints. The hub re-loads order on
      // next mount, so the order array stays accurate. site_settings
      // edits still go through supabase here — they don't yet have an
      // admin API route, and the read path is best-effort cleanup.
      if (supabase) {
        const { data: row } = await supabase
          .from('site_settings')
          .select('value')
          .eq('key', 'homepage_section_order')
          .maybeSingle();
        if (row?.value) {
          try {
            const arr = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
            if (Array.isArray(arr)) {
              const filtered = arr.filter((k: string) => k !== `banner:${id}`);
              await supabase
                .from('site_settings')
                .update({ value: JSON.stringify(filtered), updated_at: new Date().toISOString() })
                .eq('key', 'homepage_section_order');
            }
          } catch { /* ignore */ }
        }
      }
      revalidateHomepageData('homepage_banners');
      toast.show('띠배너가 삭제되었습니다.', 'success');
      // If embedded in the homepage drawer, signal close; else go back.
      if (typeof window !== 'undefined' && window.parent !== window) {
        try {
          window.parent.postMessage(
            { type: 'kokkok-builder-editor-close' },
            window.location.origin,
          );
        } catch { /* ignore */ }
      } else {
        router.push('/admin/homepage');
      }
    } catch (err) {
      console.error('[admin/banners] delete failed:', err);
      toast.show('삭제에 실패했습니다.', 'error');
    }
  }

  const dirty = JSON.stringify(data) !== JSON.stringify(saved);
  useUnsavedChanges(dirty);

  if (loading) return <LoadingState />;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-[#1f2937]">띠배너 편집</h1>
        <button
          type="button"
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-medium text-[#dc2626] border border-[#fecaca] rounded hover:bg-[#fef2f2] transition-colors kokkok-keep-border"
        >
          <Trash2 className="w-3.5 h-3.5" /> 삭제
        </button>
      </div>

      <BannerEditForm
        data={data}
        activeLang={activeLang}
        dirty={dirty}
        saving={saving}
        savedFlash={savedFlash}
        onActiveLangChange={setActiveLang}
        onChange={setData}
        onSave={handleSave}
      />
    </div>
  );
}
