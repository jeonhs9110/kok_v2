'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Upload, Trash2, Link as LinkIcon, ImageIcon, GalleryHorizontal, Eye } from 'lucide-react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, StatStrip } from '@/components/admin/CafeWidgets';

// Session-aware client. Phase 2 RLS lockdown on `promo_banners` requires admin JWT.
const supabase = getSupabaseBrowser();
const BUCKET = 'product-images';

interface PromoBanner {
  id: string;
  image_url: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
}

const EMPTY_BANNER: Omit<PromoBanner, 'id'> = {
  image_url: '',
  link_url: '',
  sort_order: 0,
  is_active: true,
};

export default function PromoBannersAdminPage() {
  const [banners, setBanners] = useState<PromoBanner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<string | null>(null);

  useEffect(() => { fetchBanners(); }, []);

  async function fetchBanners() {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('no client');
      const { data, error } = await supabase
        .from('promo_banners')
        .select('*')
        .order('sort_order');
      if (error) throw error;
      // Ensure exactly 2 slots
      const existing = (data || []).slice(0, 2);
      while (existing.length < 2) {
        existing.push({ id: `new-${existing.length}`, ...EMPTY_BANNER, sort_order: existing.length });
      }
      setBanners(existing);
    } catch {
      setBanners([
        { id: 'new-0', ...EMPTY_BANNER, sort_order: 0 },
        { id: 'new-1', ...EMPTY_BANNER, sort_order: 1 },
      ]);
    } finally {
      setIsLoading(false);
    }
  }

  const handleImageUpload = async (file: File, bannerId: string) => {
    if (!supabase) return;
    setUploadingSlot(bannerId);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const fileName = `promo-banners/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, file, {
        cacheControl: '3600', upsert: false, contentType: file.type,
      });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      setBanners(prev => prev.map(b => b.id === bannerId ? { ...b, image_url: urlData.publicUrl } : b));
    } catch (e) {
      console.error('Upload failed:', e);
      alert('이미지 업로드에 실패했습니다.');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleSave = async (banner: PromoBanner) => {
    if (!supabase) return;
    setSaving(banner.id);
    try {
      const payload = {
        image_url: banner.image_url,
        link_url: banner.link_url,
        sort_order: banner.sort_order,
        is_active: banner.is_active,
      };
      if (banner.id.startsWith('new-')) {
        const { data, error } = await supabase.from('promo_banners').insert([payload]).select().single();
        if (error) throw error;
        setBanners(prev => prev.map(b => b.id === banner.id ? { ...data } : b));
        alert('배너가 저장되었습니다.');
      } else {
        const { error } = await supabase.from('promo_banners').update(payload).eq('id', banner.id);
        if (error) throw error;
        alert('배너가 수정되었습니다.');
      }
      revalidateHomepageData('promo_banners');
    } catch (e) {
      console.error(e);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (banner: PromoBanner) => {
    if (banner.id.startsWith('new-')) {
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, image_url: '', link_url: '' } : b));
      return;
    }
    if (!supabase) return;
    if (!confirm('이 배너를 삭제할까요?')) return;
    try {
      await supabase.from('promo_banners').delete().eq('id', banner.id);
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, id: `new-${b.sort_order}`, image_url: '', link_url: '' } : b));
      revalidateHomepageData('promo_banners');
    } catch {
      alert('삭제에 실패했습니다.');
    }
  };

  if (isLoading) return (
    <div className="p-10 text-center text-gray-400 font-bold tracking-widest animate-pulse">불러오는 중...</div>
  );

  const filledCount = banners.filter(b => b.image_url).length;
  const activeCount = banners.filter(b => b.is_active && b.image_url).length;

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 슬롯" value={banners.length} icon={GalleryHorizontal} subLabel="홈 메인 노출" />
        <StatCard accent="#22c55e" label="이미지 업로드됨" value={filledCount} icon={ImageIcon} subLabel={`${banners.length}개 슬롯 중`} />
        <StatCard accent="#8b5cf6" label="게시중" value={activeCount} icon={Eye} subLabel="활성 + 이미지 있음" />
        <StatCard accent="#f59e0b" label="비어있음" value={banners.length - filledCount} icon={ImageIcon} subLabel="이미지 없는 슬롯" />
      </StatStrip>

      <div className="bg-white rounded border border-[#e5e7eb] p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">프로모 배너 관리</h2>
        <p className="text-sm text-gray-500">홈페이지 히어로 아래에 표시되는 1:1 비율 클릭 배너 2개를 관리합니다.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banners.map((banner, idx) => (
          <div key={banner.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-4 border-b border-gray-100 bg-gray-50 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-700">배너 {idx + 1}</span>
              {banner.image_url && (
                <button
                  onClick={() => handleDelete(banner)}
                  className="text-red-400 hover:text-red-600 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Image slot */}
            <div
              className="relative aspect-square bg-gray-50 flex items-center justify-center cursor-pointer group border-2 border-dashed border-gray-200 hover:border-gray-400 transition-colors m-4 rounded-lg overflow-hidden"
              onClick={() => {
                activeSlotRef.current = banner.id;
                fileInputRef.current?.click();
              }}
            >
              {banner.image_url ? (
                <>
                  <Image src={banner.image_url} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Upload className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-400 group-hover:text-gray-600 transition-colors">
                  {uploadingSlot === banner.id ? (
                    <div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <ImageIcon className="w-8 h-8" />
                      <span className="text-xs font-semibold">클릭하여 이미지 업로드</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Or paste URL */}
            <div className="px-4 pb-2">
              <div className="flex items-center gap-2 text-[10px] text-gray-400 mb-2">
                <div className="h-px flex-1 bg-gray-100" />
                <span className="font-semibold">또는 URL 직접 입력</span>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <input
                type="url"
                value={banner.image_url}
                onChange={e => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, image_url: e.target.value } : b))}
                placeholder="https://..."
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:border-black outline-none transition"
              />
            </div>

            {/* Link URL */}
            <div className="px-4 pb-4 space-y-1">
              <label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase flex items-center gap-1">
                <LinkIcon className="w-3 h-3" /> 클릭 링크 URL
              </label>
              <input
                type="text"
                value={banner.link_url}
                onChange={e => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, link_url: e.target.value } : b))}
                placeholder="https://example.com 또는 /kr/products"
                className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:border-black outline-none transition"
              />
            </div>

            <div className="px-4 pb-4">
              <button
                onClick={() => handleSave(banner)}
                disabled={saving === banner.id || !banner.image_url}
                className="w-full bg-brand-ink text-white py-2.5 rounded text-sm font-bold tracking-widest hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {saving === banner.id ? (
                  <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
                ) : '저장'}
              </button>
            </div>
          </div>
        ))}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file || !activeSlotRef.current) return;
          await handleImageUpload(file, activeSlotRef.current);
          e.target.value = '';
        }}
      />
    </div>
  );
}
