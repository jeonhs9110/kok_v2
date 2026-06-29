import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useIsDirty } from '@/hooks/useIsDirty';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { resolveAnchor } from '@/lib/typography/options';
import { USE_RDS_FROM_BROWSER } from '@/lib/admin/rdsFlag';
import { uploadFileToS3, USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';
import type { SubHero } from './types';

const supabase = getSupabaseBrowser();
const BUCKET = 'product-images';

const EMPTY: SubHero = {
  id: null, image_url: '', link_url: '', title: '', subtitle: '',
  title_size_offset: 0, subtitle_size_offset: 0, is_active: true,
  title_font_family: null, subtitle_font_family: null,
  title_bold: true,  title_italic: false,    title_underline: false,
  subtitle_bold: false, subtitle_italic: false, subtitle_underline: false,
  title_color: null, subtitle_color: null,
  text_position: 'mc',
  text_position_mobile: 'mc',
  text_anchor: { x: 50, y: 50 },
  text_anchor_mobile: { x: 50, y: 50 },
  image_anchor: { x: 50, y: 50 },
  image_anchor_mobile: { x: 50, y: 50 },
};

/**
 * State + handlers for /admin/sub-hero. Owns the banner row, savedBanner
 * snapshot for unsaved-change detection, upload + save handlers, and the
 * resolveAnchor() fallback for pre-migration-30 rows.
 */
export function useSubHero() {
  const toast = useToast();
  const [banner, setBanner] = useState<SubHero>(EMPTY);
  // Snapshot of last persisted state — drives the unsaved-change guard.
  const [savedBanner, setSavedBanner] = useState<SubHero>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [previewView, setPreviewView] = useState<'pc' | 'mobile'>('pc');

  useEffect(() => { fetchBanner(); }, []);

  async function fetchBanner() {
    setIsLoading(true);
    try {
      let data: Record<string, unknown> | null = null;
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch('/api/admin/sub-hero-banners', { cache: 'no-store' });
        if (res.ok) {
          const { rows } = await res.json() as { rows: Record<string, unknown>[] };
          data = rows[0] ?? null;
        }
      } else {
        if (!supabase) throw new Error('no client');
        const r = await supabase
          .from('sub_hero_banners')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        data = (r.data as Record<string, unknown> | null) ?? null;
      }
      if (data) {
        const d = data as Record<string, unknown>;
        // Resolve continuous anchors with legacy 9-cell key as fallback
        // for rows saved before migration 30.
        const hydrated: SubHero = {
          ...(data as unknown as SubHero),
          text_anchor:        resolveAnchor(d.text_anchor, d.text_position as string | null),
          text_anchor_mobile: resolveAnchor(d.text_anchor_mobile, d.text_position_mobile as string | null),
          image_anchor:       resolveAnchor(d.image_anchor, null),
          image_anchor_mobile: resolveAnchor(d.image_anchor_mobile, null),
        };
        setBanner(hydrated);
        setSavedBanner(hydrated);
      }
    } catch { /* use empty */ }
    finally { setIsLoading(false); }
  }

  useUnsavedChanges(useIsDirty(banner, savedBanner));

  // Live preview broadcast — when embedded inside the /admin/homepage
  // builder drawer, post every formData change up to the parent hub so
  // the central 1440px storefront iframe overlays the in-flight values
  // on the SubHeroBanner. rAF-debounced to coalesce rapid color-picker
  // / slider drags into a single paint. No-op when not embedded.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    const handle = requestAnimationFrame(() => {
      const override = {
        image_url: banner.image_url,
        link_url: banner.link_url,
        title: banner.title,
        subtitle: banner.subtitle,
        title_size_offset: banner.title_size_offset,
        subtitle_size_offset: banner.subtitle_size_offset,
        is_active: banner.is_active,
        title_font_family: banner.title_font_family,
        subtitle_font_family: banner.subtitle_font_family,
        title_bold: banner.title_bold,
        title_italic: banner.title_italic,
        title_underline: banner.title_underline,
        subtitle_bold: banner.subtitle_bold,
        subtitle_italic: banner.subtitle_italic,
        subtitle_underline: banner.subtitle_underline,
        title_color: banner.title_color,
        subtitle_color: banner.subtitle_color,
        text_position: banner.text_position,
        text_position_mobile: banner.text_position_mobile,
        text_anchor: banner.text_anchor,
        text_anchor_mobile: banner.text_anchor_mobile,
        image_anchor: banner.image_anchor,
        image_anchor_mobile: banner.image_anchor_mobile,
      };
      try {
        window.parent.postMessage(
          { type: 'kokkok-builder-subhero-preview', override },
          window.location.origin,
        );
      } catch { /* best-effort; save is source of truth */ }
    });
    return () => cancelAnimationFrame(handle);
  }, [banner]);

  // Clear the override on unmount so the storefront drops back to the
  // persisted row when the drawer closes.
  useEffect(() => {
    return () => {
      if (typeof window === 'undefined' || window.parent === window) return;
      try {
        window.parent.postMessage(
          { type: 'kokkok-builder-subhero-preview', override: null },
          window.location.origin,
        );
      } catch { /* ignore */ }
    };
  }, []);

  const handleFileUpload = async (file: File) => {
    setIsUploading(true);
    try {
      let publicUrl: string;
      if (USE_S3_FROM_BROWSER) {
        const r = await uploadFileToS3(file, { keyPrefix: 'sub-hero', contentType: file.type });
        publicUrl = r.publicUrl;
      } else {
        if (!supabase) return;
        const ext = file.name.split('.').pop() ?? 'jpg';
        const fileName = `sub-hero/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
          cacheControl: '3600', upsert: false, contentType: file.type,
        });
        if (error) throw error;
        publicUrl = supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl;
      }
      setBanner(prev => ({ ...prev, image_url: publicUrl }));
    } catch (e) {
      console.error(e);
      toast.show('이미지 업로드에 실패했습니다.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!banner.image_url) return;
    setIsSaving(true);
    try {
      const payload = {
        image_url: banner.image_url,
        link_url: banner.link_url,
        title: banner.title,
        subtitle: banner.subtitle,
        title_size_offset: banner.title_size_offset,
        subtitle_size_offset: banner.subtitle_size_offset,
        is_active: banner.is_active,
        title_font_family: banner.title_font_family,
        subtitle_font_family: banner.subtitle_font_family,
        title_bold: banner.title_bold,
        title_italic: banner.title_italic,
        title_underline: banner.title_underline,
        subtitle_bold: banner.subtitle_bold,
        subtitle_italic: banner.subtitle_italic,
        subtitle_underline: banner.subtitle_underline,
        title_color: banner.title_color,
        subtitle_color: banner.subtitle_color,
        text_position: banner.text_position,
        text_position_mobile: banner.text_position_mobile,
        // Migration 30 anchors — saved in both forms for rollback safety.
        text_anchor: banner.text_anchor,
        text_anchor_mobile: banner.text_anchor_mobile,
        // Migration 31 anchors — image focal point per breakpoint.
        image_anchor: banner.image_anchor,
        image_anchor_mobile: banner.image_anchor_mobile,
      };
      let savedId = banner.id;
      if (USE_RDS_FROM_BROWSER) {
        const url = banner.id
          ? `/api/admin/sub-hero-banners?id=${encodeURIComponent(banner.id)}`
          : '/api/admin/sub-hero-banners';
        const res = await fetch(url, {
          method: banner.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        if (!banner.id) {
          const { row } = await res.json() as { row: { id: string } | null };
          savedId = row?.id ?? null;
          if (savedId) setBanner(prev => ({ ...prev, id: savedId }));
        }
      } else {
        if (!supabase) throw new Error('no client');
        if (banner.id) {
          const { error } = await supabase.from('sub_hero_banners').update(payload).eq('id', banner.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('sub_hero_banners').insert([payload]).select().single();
          if (error) throw error;
          savedId = data.id;
          setBanner(prev => ({ ...prev, id: data.id }));
        }
      }
      setSavedBanner({ ...banner, id: savedId });
      revalidateHomepageData('sub_hero');
      toast.show('서브 히어로 배너가 저장되었습니다.', 'success');
    } catch (e) {
      console.error(e);
      toast.show('저장에 실패했습니다.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  return {
    banner, setBanner,
    isLoading, isSaving, isUploading,
    previewView, setPreviewView,
    handleFileUpload, handleSave,
  };
}
