import { useCallback, useRef, useState } from 'react';
import type { SupabaseClient } from '@supabase/supabase-js';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/Toast';
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
    if (!bgPending || !supabase) return;
    setBgUploading(true);
    try {
      const ext = bgPending.name.split('.').pop()?.toLowerCase() ?? 'bin';
      const isVideo = bgPending.type.startsWith('video/');
      const path = `backgrounds/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bgPending, {
        upsert: false,
        contentType: bgPending.type || undefined,
      });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      const { error: insErr } = await supabase.from('site_backgrounds').insert({
        file_url: urlData.publicUrl,
        file_name: bgPending.name,
        file_type: isVideo ? 'video' : 'image',
        mime_type: bgPending.type || '',
        is_active: false,
      });
      if (insErr) throw insErr;
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

  const activateBackground = async (id: string) => {
    if (!supabase) return;
    setBgBusyId(id);
    try {
      await supabase.from('site_backgrounds').update({ is_active: false }).neq('id', id);
      await supabase.from('site_backgrounds').update({ is_active: true }).eq('id', id);
      await loadBackgrounds();
      onIframeReload();
    } finally {
      setBgBusyId(null);
    }
  };

  const deactivateBackground = async (id: string) => {
    if (!supabase) return;
    setBgBusyId(id);
    try {
      await supabase.from('site_backgrounds').update({ is_active: false }).eq('id', id);
      await loadBackgrounds();
      onIframeReload();
    } finally {
      setBgBusyId(null);
    }
  };

  const toggleScrollDriven = async (bg: Background) => {
    if (!supabase) return;
    setBgBusyId(bg.id);
    try {
      await supabase
        .from('site_backgrounds')
        .update({ scroll_driven: !bg.scroll_driven })
        .eq('id', bg.id);
      await loadBackgrounds();
    } finally {
      setBgBusyId(null);
    }
  };

  const deleteBackground = async (bg: Background) => {
    if (!supabase) return;
    const ok = await confirm({ message: `"${bg.file_name || '이 배경'}"을(를) 삭제하시겠습니까?`, tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    setBgBusyId(bg.id);
    try {
      const marker = `/${BUCKET}/`;
      const idx = bg.file_url.indexOf(marker);
      if (idx >= 0) {
        const objPath = bg.file_url.slice(idx + marker.length);
        await supabase.storage.from(BUCKET).remove([objPath]);
      }
      await supabase.from('site_backgrounds').delete().eq('id', bg.id);
      await loadBackgrounds();
      onIframeReload();
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
