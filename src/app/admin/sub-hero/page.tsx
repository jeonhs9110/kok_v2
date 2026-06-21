'use client';

import { useState, useEffect } from 'react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { resolveAnchor } from '@/lib/typography/options';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useToast } from '@/components/admin/Toast';
import { LoadingState } from '@/components/admin/CafeWidgets';
import type { SubHero } from './_components/types';
import SubHeroPreview from './_components/SubHeroPreview';
import SubHeroImageUpload from './_components/SubHeroImageUpload';
import SubHeroFontSizeOffsets from './_components/SubHeroFontSizeOffsets';
import SubHeroTypographyAndPosition from './_components/SubHeroTypographyAndPosition';
import SubHeroBasicFields from './_components/SubHeroBasicFields';

// Session-aware client. Phase 2 RLS lockdown on `sub_hero_banners` requires admin JWT.
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

export default function SubHeroAdminPage() {
  const toast = useToast();
  const [banner, setBanner] = useState<SubHero>(EMPTY);
  // Snapshot of last persisted state so we can detect unsaved local edits
  // (drives the navigation-away prompt below).
  const [savedBanner, setSavedBanner] = useState<SubHero>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  // Preview-only toggle so the admin can see how the banner reads at
  // each breakpoint without leaving the page. Same pattern as the
  // carousel modal preview.
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
        // Resolve continuous anchors with the legacy 9-cell key as
        // fallback for rows saved before migration 30.
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

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded border border-[#e5e7eb] p-5">
        <h2 className="text-[14px] font-bold text-[#1f2937] mb-1">서브 히어로 배너 관리</h2>
        <p className="text-sm text-gray-500">홈페이지 영상 리뷰 아래에 표시되는 전체 너비 배너입니다.</p>
      </div>

      <div className="bg-white rounded border border-[#e5e7eb] p-5 space-y-5">

        <SubHeroPreview
          banner={banner}
          previewView={previewView}
          onChangeView={setPreviewView}
        />

        <SubHeroImageUpload
          imageUrl={banner.image_url}
          isUploading={isUploading}
          onPickFile={handleFileUpload}
          onUrlChange={url => setBanner(prev => ({ ...prev, image_url: url }))}
        />

        <SubHeroFontSizeOffsets
          banner={banner}
          onChange={(key, value) => setBanner(prev => ({ ...prev, [key]: value }))}
        />

        <SubHeroTypographyAndPosition
          banner={banner}
          onChange={patch => setBanner(prev => ({ ...prev, ...patch }))}
        />

        <SubHeroBasicFields
          banner={banner}
          isSaving={isSaving}
          onChange={patch => setBanner(prev => ({ ...prev, ...patch }))}
          onSave={handleSave}
        />
      </div>
    </div>
  );
}
