import { useCallback, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/Toast';
import { USE_RDS_FROM_BROWSER } from '@/lib/admin/rdsFlag';
import { uploadFileToS3, USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import type { Background } from './BackgroundMediaCard';

const BUCKET = 'site-assets';
const MAX_BG_SIZE = 50 * 1024 * 1024; // 50MB

interface Options {
  supabase: SupabaseClient | null;
  toast: ReturnType<typeof useToast>;
  confirm: ReturnType<typeof useConfirm>;
  onIframeReload: () => void;
}

/**
 * Background-media side of /admin/logo. Owns the bgPending file picker,
 * upload, activate/deactivate, scroll-driven toggle, and delete flow.
 * Returns a {state, refs, handlers, accept} bag the page wires straight
 * into BackgroundMediaCard.
 */
export function useBackgroundManagement({ supabase, toast, confirm, onIframeReload }: Options) {
  const [backgrounds, setBackgrounds] = useState<Background[]>([]);
  const [bgPending, setBgPending] = useState<File | null>(null);
  const [bgUploading, setBgUploading] = useState(false);
  const [bgBusyId, setBgBusyId] = useState<string | null>(null);
  const bgInputRef = useRef<HTMLInputElement>(null);

  const loadBackgrounds = useCallback(async () => {
    if (USE_RDS_FROM_BROWSER) {
      const res = await fetch('/api/admin/site-backgrounds', { cache: 'no-store' });
      if (!res.ok) return;
      const { rows } = await res.json() as { rows: Background[] };
      setBackgrounds(rows ?? []);
      return;
    }
    if (!supabase) return;
    const { data } = await supabase
      .from('site_backgrounds')
      .select('*')
      .order('created_at', { ascending: false });
    setBackgrounds((data ?? []) as Background[]);
  }, [supabase]);

  const handleBgPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > MAX_BG_SIZE) {
      toast.show(`파일 크기가 ${MAX_BG_SIZE / 1024 / 1024}MB를 초과합니다.`, 'warning');
      e.target.value = '';
      return;
    }
    setBgPending(f);
  };

  const uploadBackground = async () => {
    if (!bgPending) return;
    setBgUploading(true);
    try {
      const isVideo = bgPending.type.startsWith('video/');
      let publicUrl: string;
      if (USE_S3_FROM_BROWSER) {
        const r = await uploadFileToS3(bgPending, { keyPrefix: 'backgrounds', contentType: bgPending.type });
        publicUrl = r.publicUrl;
      } else {
        if (!supabase) return;
        const ext = bgPending.name.split('.').pop()?.toLowerCase() ?? 'bin';
        const path = `backgrounds/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bgPending, {
          upsert: false,
          contentType: bgPending.type || undefined,
        });
        if (upErr) throw upErr;
        publicUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
      }
      const payload = {
        file_url: publicUrl,
        file_name: bgPending.name,
        file_type: isVideo ? 'video' : 'image',
        mime_type: bgPending.type || '',
        is_active: false,
      };
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch('/api/admin/site-backgrounds', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
      } else {
        if (!supabase) return;
        const { error: insErr } = await supabase.from('site_backgrounds').insert(payload);
        if (insErr) throw insErr;
      }
      setBgPending(null);
      if (bgInputRef.current) bgInputRef.current.value = '';
      await loadBackgrounds();
    } catch (err) {
      console.error(err);
      toast.show('배경 업로드에 실패했습니다.', 'error');
    } finally {
      setBgUploading(false);
    }
  };

  // 2026-06-29: every site_background mutation now follows with a
  // revalidateHomepageData('site_background') so the storefront's
  // unstable_cache (getActiveSiteBackground, tagged 'site_background')
  // is evicted immediately. The prior code only called onIframeReload()
  // on the admin side — the local iframe restarted, but the public
  // storefront kept rendering the previously-active background until
  // the 60s ISR window expired. Particularly jarring for video
  // backgrounds where the operator hits Activate and expects the live
  // storefront preview to follow.
  const activateBackground = async (id: string) => {
    setBgBusyId(id);
    try {
      if (USE_RDS_FROM_BROWSER) {
        // Mark all others inactive, then activate this one. The generic
        // route doesn't expose a bulk WHERE id != $1; do it in two steps
        // (list + PATCH each) so the toggle stays atomic from the user's
        // perspective.
        const listRes = await fetch('/api/admin/site-backgrounds', { cache: 'no-store' });
        if (listRes.ok) {
          const body = await listRes.json() as { rows: Background[] };
          await Promise.all(body.rows
            .filter(r => r.id !== id && r.is_active)
            .map(r => fetch(`/api/admin/site-backgrounds?id=${encodeURIComponent(r.id)}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_active: false }),
            })));
        }
        await fetch(`/api/admin/site-backgrounds?id=${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: true }),
        });
      } else {
        if (!supabase) return;
        await supabase.from('site_backgrounds').update({ is_active: false }).neq('id', id);
        await supabase.from('site_backgrounds').update({ is_active: true }).eq('id', id);
      }
      await loadBackgrounds();
      await revalidateHomepageData('site_background');
      onIframeReload();
    } finally {
      setBgBusyId(null);
    }
  };

  const deactivateBackground = async (id: string) => {
    setBgBusyId(id);
    try {
      if (USE_RDS_FROM_BROWSER) {
        await fetch(`/api/admin/site-backgrounds?id=${encodeURIComponent(id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: false }),
        });
      } else if (supabase) {
        await supabase.from('site_backgrounds').update({ is_active: false }).eq('id', id);
      }
      await loadBackgrounds();
      await revalidateHomepageData('site_background');
      onIframeReload();
    } finally {
      setBgBusyId(null);
    }
  };

  const toggleScrollDriven = async (bg: Background) => {
    setBgBusyId(bg.id);
    try {
      if (USE_RDS_FROM_BROWSER) {
        // res.ok check — without it a 500 PATCH still flowed into
        // loadBackgrounds() which (correctly) re-fetched the OLD value,
        // and the operator saw the toggle flip in their hand then
        // revert silently with no error signal. Surface the failure.
        const res = await fetch(`/api/admin/site-backgrounds?id=${encodeURIComponent(bg.id)}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ scroll_driven: !bg.scroll_driven }),
        });
        if (!res.ok) throw new Error(`http_${res.status}`);
      } else if (supabase) {
        const { error } = await supabase
          .from('site_backgrounds')
          .update({ scroll_driven: !bg.scroll_driven })
          .eq('id', bg.id);
        if (error) throw error;
      }
      await loadBackgrounds();
      // Only evict if the toggled row is the currently-active one — the
      // storefront only reads the active row, so scroll_driven changes
      // on inactive rows don't affect public render.
      if (bg.is_active) await revalidateHomepageData('site_background');
    } catch (err) {
      console.error('[admin/logo/bg] toggleScrollDriven failed:', err);
      toast.show('스크롤 효과 설정 변경에 실패했습니다.', 'error');
    } finally {
      setBgBusyId(null);
    }
  };

  const deleteBackground = async (bg: Background) => {
    const ok = await confirm({ message: `"${bg.file_name || '이 배경'}"을(를) 삭제하시겠습니까?`, tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    setBgBusyId(bg.id);
    try {
      // S3-side object cleanup. Post-cutover the file lives on S3
      // (CloudFront-fronted), so the previous supabase.storage.remove
      // call was a no-op against a decommissioned bucket — every
      // deleted background (often a 20-50MB video) was leaking as
      // an orphan indefinitely. Best-effort: log but don't fail the
      // whole delete if S3 removal returns non-ok, so the DB row
      // still gets removed and the operator isn't stuck.
      const marker = `/${BUCKET}/`;
      const idx = bg.file_url.indexOf(marker);
      if (idx >= 0) {
        const objPath = bg.file_url.slice(idx + marker.length);
        try {
          const storageRes = await fetch(
            `/api/admin/storage/delete?bucket=${encodeURIComponent(BUCKET)}&key=${encodeURIComponent(objPath)}`,
            { method: 'DELETE' },
          );
          if (!storageRes.ok) {
            console.warn(`[admin/logo/bg] S3 delete non-ok for ${objPath}: ${storageRes.status}`);
          }
        } catch (err) {
          console.warn('[admin/logo/bg] S3 delete threw:', err);
        }
      }
      if (USE_RDS_FROM_BROWSER) {
        // res.ok check — without it a 500 DELETE left the DB row alive
        // while the storage object (deleted earlier in this same
        // handler, line 214) was already gone. Storefront's next render
        // 404'd on the background image. Surface so the operator can
        // retry — if DB delete keeps failing, at least they know the
        // background is now broken instead of seeing "success".
        const res = await fetch(`/api/admin/site-backgrounds?id=${encodeURIComponent(bg.id)}`, { method: 'DELETE' });
        if (!res.ok) throw new Error(`http_${res.status}`);
      } else if (supabase) {
        const { error } = await supabase.from('site_backgrounds').delete().eq('id', bg.id);
        if (error) throw error;
      }
      await loadBackgrounds();
      // Always evict on delete: even if the row was inactive, the
      // storefront's previously-cached active row might reference an
      // object we just removed from storage (rare but real after
      // multi-tab editing).
      await revalidateHomepageData('site_background');
      onIframeReload();
    } catch (err) {
      console.error('[admin/logo/bg] delete failed:', err);
      toast.show('배경 삭제에 실패했습니다. 페이지를 새로고침해주세요.', 'error');
    } finally {
      setBgBusyId(null);
    }
  };

  return {
    backgrounds,
    bgPending,
    bgUploading,
    bgBusyId,
    bgInputRef,
    accept: 'image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm',
    loadBackgrounds,
    handleBgPick,
    uploadBackground,
    activateBackground,
    deactivateBackground,
    toggleScrollDriven,
    deleteBackground,
  };
}
