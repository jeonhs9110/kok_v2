'use client';

import { useState, useEffect, useRef } from 'react';
import { ImageIcon, GalleryHorizontal, Eye } from 'lucide-react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, StatStrip, PageHeader, LoadingState } from '@/components/admin/CafeWidgets';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { USE_RDS_FROM_BROWSER } from '@/lib/admin/rdsFlag';
import { uploadFileToS3, USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';
import PromoBannerSlot, { type PromoBanner } from './_components/PromoBannerSlot';

// Session-aware client. Phase 2 RLS lockdown on `promo_banners` requires admin JWT.
const supabase = getSupabaseBrowser();
const BUCKET = 'product-images';

const EMPTY_BANNER: Omit<PromoBanner, 'id'> = {
  image_url: '',
  link_url: '',
  sort_order: 0,
  is_active: true,
};

export default function PromoBannersAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();
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
      let data: PromoBanner[] = [];
      if (USE_RDS_FROM_BROWSER) {
        const res = await fetch('/api/admin/promo-banners', { cache: 'no-store' });
        if (!res.ok) throw new Error(`API ${res.status}`);
        const body = await res.json() as { rows: PromoBanner[] };
        data = body.rows ?? [];
      } else {
        if (!supabase) throw new Error('no client');
        const r = await supabase
          .from('promo_banners')
          .select('*')
          .order('sort_order');
        if (r.error) throw r.error;
        data = (r.data as PromoBanner[] | null) ?? [];
      }
      // Ensure exactly 2 slots
      const existing = data.slice(0, 2);
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
    setUploadingSlot(bannerId);
    try {
      let publicUrl: string;
      if (USE_S3_FROM_BROWSER) {
        const r = await uploadFileToS3(file, { keyPrefix: 'promo-banners', contentType: file.type });
        publicUrl = r.publicUrl;
      } else {
        if (!supabase) return;
        const ext = file.name.split('.').pop() ?? 'jpg';
        const fileName = `promo-banners/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage.from(BUCKET).upload(fileName, file, {
          cacheControl: '3600', upsert: false, contentType: file.type,
        });
        if (uploadError) throw uploadError;
        publicUrl = supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl;
      }
      setBanners(prev => prev.map(b => b.id === bannerId ? { ...b, image_url: publicUrl } : b));
    } catch (e) {
      console.error('Upload failed:', e);
      toast.show('이미지 업로드에 실패했습니다.', 'error');
    } finally {
      setUploadingSlot(null);
    }
  };

  const handleSave = async (banner: PromoBanner) => {
    setSaving(banner.id);
    try {
      const payload = {
        image_url: banner.image_url,
        link_url: banner.link_url,
        sort_order: banner.sort_order,
        is_active: banner.is_active,
      };
      const isNew = banner.id.startsWith('new-');
      if (USE_RDS_FROM_BROWSER) {
        const url = isNew
          ? '/api/admin/promo-banners'
          : `/api/admin/promo-banners?id=${encodeURIComponent(banner.id)}`;
        const res = await fetch(url, {
          method: isNew ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        if (isNew) {
          const { row } = await res.json() as { row: PromoBanner | null };
          if (row) setBanners(prev => prev.map(b => b.id === banner.id ? row : b));
        }
      } else {
        if (!supabase) return;
        if (isNew) {
          const { data, error } = await supabase.from('promo_banners').insert([payload]).select().single();
          if (error) throw error;
          setBanners(prev => prev.map(b => b.id === banner.id ? { ...data } : b));
        } else {
          const { error } = await supabase.from('promo_banners').update(payload).eq('id', banner.id);
          if (error) throw error;
        }
      }
      toast.show(isNew ? '배너가 저장되었습니다' : '배너가 수정되었습니다', 'success');
      revalidateHomepageData('promo_banners');
    } catch (e) {
      console.error(e);
      toast.show('저장에 실패했습니다.', 'error');
    } finally {
      setSaving(null);
    }
  };

  const handleDelete = async (banner: PromoBanner) => {
    if (banner.id.startsWith('new-')) {
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, image_url: '', link_url: '' } : b));
      return;
    }
    const ok = await confirm({ message: '이 배너를 삭제할까요?', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    try {
      if (USE_RDS_FROM_BROWSER) {
        await fetch(`/api/admin/promo-banners?id=${encodeURIComponent(banner.id)}`, { method: 'DELETE' });
      } else if (supabase) {
        await supabase.from('promo_banners').delete().eq('id', banner.id);
      }
      setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, id: `new-${b.sort_order}`, image_url: '', link_url: '' } : b));
      revalidateHomepageData('promo_banners');
    } catch {
      toast.show('삭제에 실패했습니다.', 'error');
    }
  };

  if (isLoading) return <LoadingState />;

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

      <PageHeader
        title="프로모 배너 관리"
        description="홈페이지 히어로 아래에 표시되는 1:1 비율 클릭 배너 2개를 관리합니다"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {banners.map((banner, idx) => (
          <PromoBannerSlot
            key={banner.id}
            banner={banner}
            index={idx}
            uploadingSlot={uploadingSlot}
            saving={saving}
            onPickFile={() => {
              activeSlotRef.current = banner.id;
              fileInputRef.current?.click();
            }}
            onUrlChange={url => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, image_url: url } : b))}
            onLinkChange={link => setBanners(prev => prev.map(b => b.id === banner.id ? { ...b, link_url: link } : b))}
            onSave={() => handleSave(banner)}
            onDelete={() => handleDelete(banner)}
          />
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
