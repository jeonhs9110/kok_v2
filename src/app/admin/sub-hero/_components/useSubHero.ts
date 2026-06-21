import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { resolveAnchor } from '@/lib/typography/options';
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
      if (!supabase) throw new Error('no client');
      const { data } = await supabase
        .from('sub_hero_banners')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        // Resolve continuous anchors with legacy 9-cell key as fallback
        // for rows saved before migration 30.
        const hydrated: SubHero = {
          ...(data as SubHero),
          text_anchor:        resolveAnchor(data.text_anchor, data.text_position),
          text_anchor_mobile: resolveAnchor(data.text_anchor_mobile, data.text_position_mobile),
          image_anchor:       resolveAnchor(data.image_anchor, null),
          image_anchor_mobile: resolveAnchor(data.image_anchor_mobile, null),
        };
        setBanner(hydrated);
        setSavedBanner(hydrated);
      }
    } catch { /* use empty */ }
    finally { setIsLoading(false); }
  }

  useUnsavedChanges(JSON.stringify(banner) !== JSON.stringify(savedBanner));

  const handleFileUpload = async (file: File) => {
    if (!supabase) return;
    setIsUploading(true);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const fileName = `sub-hero/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, {
        cacheControl: '3600', upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      setBanner(prev => ({ ...prev, image_url: urlData.publicUrl }));
    } catch (e) {
      console.error(e);
      toast.show('이미지 업로드에 실패했습니다.', 'error');
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    if (!supabase || !banner.image_url) return;
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
      if (banner.id) {
        const { error } = await supabase.from('sub_hero_banners').update(payload).eq('id', banner.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('sub_hero_banners').insert([payload]).select().single();
        if (error) throw error;
        savedId = data.id;
        setBanner(prev => ({ ...prev, id: data.id }));
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
