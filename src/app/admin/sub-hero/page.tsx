'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Upload, ImageIcon } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const BUCKET = 'product-images';

interface SubHero {
  id: string | null;
  image_url: string;
  link_url: string;
  title: string;
  subtitle: string;
  is_active: boolean;
}

const EMPTY: SubHero = { id: null, image_url: '', link_url: '', title: '', subtitle: '', is_active: true };

export default function SubHeroAdminPage() {
  const [banner, setBanner] = useState<SubHero>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
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
      if (data) setBanner(data);
    } catch { /* use empty */ }
    finally { setIsLoading(false); }
  }

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
        is_active: banner.is_active,
      };
      if (banner.id) {
        const { error } = await supabase.from('sub_hero_banners').update(payload).eq('id', banner.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('sub_hero_banners').insert([payload]).select().single();
        if (error) throw error;
        setBanner(prev => ({ ...prev, id: data.id }));
      }
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

        {/* Image upload */}
        <div>
          <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase block mb-2">배너 이미지</label>
          <div
            className="relative w-full h-52 rounded-xl overflow-hidden border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors cursor-pointer group bg-gray-50 flex items-center justify-center"
            onClick={() => fileInputRef.current?.click()}
          >
            {banner.image_url ? (
              <>
                <img src={banner.image_url} alt="" className="w-full h-full object-cover" />
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
            className="w-4 h-4 accent-[#4a7a3e] cursor-pointer"
          />
          <label htmlFor="subHeroActive" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
            홈페이지에 표시
          </label>
        </div>

        <button
          onClick={handleSave}
          disabled={isSaving || !banner.image_url}
          className="w-full bg-[#111111] text-white py-3 rounded text-sm font-bold tracking-widest hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {isSaving ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
          ) : '배너 저장'}
        </button>
      </div>
    </div>
  );
}
