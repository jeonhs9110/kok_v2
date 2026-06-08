'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Upload, ImageIcon } from 'lucide-react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { TypographyPanel } from '@/components/admin/TypographyPanel';
import ContinuousPositionPicker from '@/components/admin/ContinuousPositionPicker';
import { fontFamilyForKey, anchorTextStyle, resolveAnchor, type PositionAnchor, type PositionKey } from '@/lib/typography/options';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

// Session-aware client. Phase 2 RLS lockdown on `sub_hero_banners` requires admin JWT.
const supabase = getSupabaseBrowser();
const BUCKET = 'product-images';

interface SubHero {
  id: string | null;
  image_url: string;
  link_url: string;
  title: string;
  subtitle: string;
  title_size_offset: number;
  subtitle_size_offset: number;
  is_active: boolean;
  // Phase 2 typography columns (migration 00000000000024).
  title_font_family: string | null;
  subtitle_font_family: string | null;
  title_bold: boolean;
  title_italic: boolean;
  title_underline: boolean;
  subtitle_bold: boolean;
  subtitle_italic: boolean;
  subtitle_underline: boolean;
  title_color: string | null;
  subtitle_color: string | null;
  text_position: PositionKey;
  // Migration 28: separate anchor for the mobile breakpoint so the
  // admin can place text wherever doesn't collide with the product
  // image on a phone, without changing the desktop layout.
  text_position_mobile: PositionKey;
  // Migration 30: continuous (x, y) anchors replacing the 9-cell pickers.
  text_anchor: PositionAnchor;
  text_anchor_mobile: PositionAnchor;
}

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
};

export default function SubHeroAdminPage() {
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
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      alert('이미지 업로드에 실패했습니다.');
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
      alert('서브 히어로 배너가 저장되었습니다.');
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) return (
    <div className="p-10 text-center text-gray-400 font-bold tracking-widest animate-pulse">불러오는 중...</div>
  );

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">서브 히어로 배너 관리</h2>
        <p className="text-sm text-gray-500">홈페이지 영상 리뷰 아래에 표시되는 전체 너비 배너입니다.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">

        {/* ── Live preview ─────────────────────────────────────────
            Mirrors src/components/SubHeroBanner.tsx so admins see
            the final layout while editing instead of save → refresh
            → repeat. Font sizes are halved to fit the editor card. */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">미리보기</label>
            <div className="inline-flex bg-gray-100 rounded p-0.5 text-[10px] font-bold">
              {(['pc', 'mobile'] as const).map(v => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setPreviewView(v)}
                  className={`px-2.5 py-1 rounded transition-colors ${
                    previewView === v ? 'bg-white text-black shadow-sm' : 'text-gray-500 hover:text-black'
                  }`}
                >
                  {v === 'pc' ? 'PC' : '모바일'}
                </button>
              ))}
            </div>
          </div>
          <div className={`relative rounded-lg overflow-hidden border border-gray-200 shadow-sm bg-gray-100 mx-auto ${
            previewView === 'mobile' ? 'w-[220px] aspect-[9/14]' : 'w-full aspect-[21/9]'
          }`}>
            {banner.image_url ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={banner.image_url} alt="" className="absolute inset-0 w-full h-full object-cover" />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-gray-400 tracking-widest uppercase">
                이미지를 업로드하면 미리보기가 표시됩니다
              </div>
            )}
            {(banner.title || banner.subtitle) && (() => {
              // Mirror SubHeroBanner.tsx — anchor + edge-aware inline
              // styles, picked from the breakpoint the preview toggle
              // is showing.
              const anchor = previewView === 'mobile' ? banner.text_anchor_mobile : banner.text_anchor;
              return (
                <div className="absolute inset-0 px-6">
                  <div style={anchorTextStyle(anchor)}>
                  {banner.title && (
                    <h3
                      className="drop-shadow-lg whitespace-pre-line mb-1"
                      style={{
                        fontSize: `${Math.max(14, (32 + (banner.title_size_offset || 0)) * 0.5)}px`,
                        fontFamily: fontFamilyForKey(banner.title_font_family),
                        fontWeight: banner.title_bold ? 800 : 400,
                        fontStyle: banner.title_italic ? 'italic' : 'normal',
                        textDecoration: banner.title_underline ? 'underline' : 'none',
                        color: banner.title_color ?? '#ffffff',
                      }}
                    >
                      {banner.title}
                    </h3>
                  )}
                  {banner.subtitle && (
                    <p
                      className="drop-shadow-md"
                      style={{
                        fontSize: `${Math.max(10, (16 + (banner.subtitle_size_offset || 0)) * 0.5)}px`,
                        fontFamily: fontFamilyForKey(banner.subtitle_font_family),
                        fontWeight: banner.subtitle_bold ? 700 : 400,
                        fontStyle: banner.subtitle_italic ? 'italic' : 'normal',
                        textDecoration: banner.subtitle_underline ? 'underline' : 'none',
                        color: banner.subtitle_color ?? 'rgba(255,255,255,0.9)',
                      }}
                    >
                      {banner.subtitle}
                    </p>
                  )}
                  </div>
                </div>
              );
            })()}
            {banner.link_url && (
              <span className="absolute bottom-2 right-2 text-[9px] font-mono px-1.5 py-0.5 rounded bg-black/60 text-white">
                → {banner.link_url}
              </span>
            )}
          </div>
        </div>

        {/* Image upload */}
        <div>
          <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase block mb-2">배너 이미지</label>
          <div
            className="relative w-full h-52 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors cursor-pointer group bg-gray-50 flex items-center justify-center"
            onClick={() => fileInputRef.current?.click()}
          >
            {banner.image_url ? (
              <>
                <Image src={banner.image_url} alt="" fill sizes="100vw" className="object-cover" />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  <Upload className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-gray-600 transition-colors">
                {isUploading ? (
                  <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <>
                    <ImageIcon className="w-8 h-8" />
                    <span className="text-xs font-semibold">클릭하여 이미지 업로드</span>
                    <span className="text-xs text-gray-400">권장 비율: 16:9 또는 21:9 (와이드)</span>
                  </>
                )}
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              await handleFileUpload(file);
              e.target.value = '';
            }}
          />
          <div className="mt-2">
            <input
              type="url"
              value={banner.image_url}
              onChange={e => setBanner(prev => ({ ...prev, image_url: e.target.value }))}
              placeholder="또는 이미지 URL 직접 입력"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:border-black outline-none transition"
            />
          </div>
        </div>

        {/* Title */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">제목 (선택)</label>
          <input
            type="text"
            value={banner.title}
            onChange={e => setBanner(prev => ({ ...prev, title: e.target.value }))}
            placeholder="예: Available worldwide"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:border-black outline-none transition"
          />
        </div>

        {/* Subtitle */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">서브타이틀 (선택)</label>
          <input
            type="text"
            value={banner.subtitle}
            onChange={e => setBanner(prev => ({ ...prev, subtitle: e.target.value }))}
            placeholder="예: Let's make together"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:border-black outline-none transition"
          />
        </div>

        {/* Font size offsets */}
        <div className="space-y-3 pt-2 border-t border-gray-100">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">폰트 크기 조절</p>
            <p className="text-[10px] text-gray-400 mt-0.5">기본 크기 대비 ± px 단위로 조정 (예: -4 = 작게, +4 = 크게). 미리보기는 데스크탑 기준 실제 크기입니다.</p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            {([
              { key: 'title', label: '제목', basePx: 48, sample: '제목' },
              { key: 'subtitle', label: '서브타이틀', basePx: 16, sample: '서브타이틀' },
            ] as const).map(({ key, label, basePx, sample }) => {
              const offsetField = `${key}_size_offset` as 'title_size_offset' | 'subtitle_size_offset';
              const offset = banner[offsetField] || 0;
              const effectivePx = basePx + offset;
              const sampleText = banner[key] || sample;
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-baseline justify-between">
                    <label className="text-[10px] font-semibold text-gray-500">{label}</label>
                    <span className="text-[10px] text-gray-400 font-mono">= {effectivePx}px</span>
                  </div>
                  <input
                    type="number"
                    value={offset}
                    onChange={e => setBanner(prev => ({ ...prev, [offsetField]: parseInt(e.target.value) || 0 }))}
                    placeholder="0"
                    className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:border-black outline-none transition"
                  />
                  <div
                    className="px-2 py-1.5 border border-gray-200 rounded bg-white overflow-hidden truncate"
                    style={{ fontSize: `${effectivePx}px`, lineHeight: 1.15 }}
                    title={sampleText}
                  >
                    {sampleText}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Phase 2 typography controls ─────────────────────────────
            Font family + bold/italic/underline + color per text block,
            plus a 9-cell anchor picker for where the whole block sits
            inside the banner. Defaults keep the previous look (centered,
            bold white title, regular white subtitle). */}
        <div className="space-y-4 pt-2 border-t border-gray-100">
          <div>
            <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">타이포그래피</p>
            <p className="text-[10px] text-gray-400 mt-0.5">폰트 / 굵기 / 기울임 / 밑줄 / 색상을 텍스트별로 지정하고, 텍스트 블록의 위치를 이미지 안에서 골라보세요.</p>
          </div>
          <TypographyPanel
            label="제목 스타일"
            value={{
              fontFamily: banner.title_font_family,
              bold: banner.title_bold,
              italic: banner.title_italic,
              underline: banner.title_underline,
              color: banner.title_color,
            }}
            onChange={s => setBanner(prev => ({
              ...prev,
              title_font_family: s.fontFamily,
              title_bold: s.bold,
              title_italic: s.italic,
              title_underline: s.underline,
              title_color: s.color,
            }))}
            defaultColor="#ffffff"
          />
          <TypographyPanel
            label="서브타이틀 스타일"
            value={{
              fontFamily: banner.subtitle_font_family,
              bold: banner.subtitle_bold,
              italic: banner.subtitle_italic,
              underline: banner.subtitle_underline,
              color: banner.subtitle_color,
            }}
            onChange={s => setBanner(prev => ({
              ...prev,
              subtitle_font_family: s.fontFamily,
              subtitle_bold: s.bold,
              subtitle_italic: s.italic,
              subtitle_underline: s.underline,
              subtitle_color: s.color,
            }))}
            defaultColor="#ffffff"
          />
          {/* Dual anchor: text can be placed differently on desktop vs
              mobile (migration 28). Mirrors the carousel modal pattern
              from PR #89 so the admin gets consistent controls across
              both editors. */}
          <div>
            <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-1">텍스트 위치</p>
            <p className="text-[10px] text-gray-400 mb-2">
              미리보기에서 원하는 위치를 클릭하거나 흰 점을 드래그하세요. (PC와 모바일을 따로 설정)
            </p>
            <div className="grid grid-cols-2 gap-3">
              <ContinuousPositionPicker
                label="PC 텍스트 위치"
                value={banner.text_anchor}
                onChange={a => setBanner(prev => ({ ...prev, text_anchor: a }))}
                aspectRatio="aspect-[16/7]"
                backgroundImage={banner.image_url || undefined}
              />
              <ContinuousPositionPicker
                label="모바일 텍스트 위치"
                value={banner.text_anchor_mobile}
                onChange={a => setBanner(prev => ({ ...prev, text_anchor_mobile: a }))}
                aspectRatio="aspect-[9/14]"
                backgroundImage={banner.image_url || undefined}
              />
            </div>
          </div>
        </div>

        {/* Link URL */}
        <div className="space-y-1">
          <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">클릭 링크 URL (선택)</label>
          <input
            type="text"
            value={banner.link_url}
            onChange={e => setBanner(prev => ({ ...prev, link_url: e.target.value }))}
            placeholder="https://example.com 또는 /kr/worldwide"
            className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:border-black outline-none transition"
          />
        </div>

        {/* Active toggle */}
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="subHeroActive"
            checked={banner.is_active}
            onChange={e => setBanner(prev => ({ ...prev, is_active: e.target.checked }))}
            className="w-4 h-4 accent-[#00693A] cursor-pointer"
          />
          <label htmlFor="subHeroActive" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
            홈페이지에 표시
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !banner.image_url}
          className="w-full bg-brand-ink text-white py-3 rounded text-sm font-bold tracking-widest hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
          ) : '배너 저장'}
        </button>
      </div>
    </div>
  );
}
