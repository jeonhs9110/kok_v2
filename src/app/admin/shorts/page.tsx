'use client';
import { useState, useEffect } from 'react';
import { Video, Plus, Link2, Package } from 'lucide-react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, StatStrip, PageHeader } from '@/components/admin/CafeWidgets';
import { useToast } from '@/components/admin/Toast';
import type { SectionBgValue } from '@/components/admin/SectionBackgroundPanel';
import SectionBgCard from '@/components/admin/SectionBgCard';
import ShortsHeaderStyleCard from './_components/ShortsHeaderStyleCard';
import ShortsGrid from './_components/ShortsGrid';

// Session-aware client. Phase 2 RLS lockdown on `shorts` requires admin JWT.
const supabase = getSupabaseBrowser();

const EMPTY_BG: SectionBgValue = { type: null, color: null, mediaUrl: null, mediaType: null };

interface Short {
  id: string;
  youtubeId: string;
  productId: string | null;
  productName: string | null;
  addedAt: string;
}

interface Product {
  id: string;
  name: string;
}

export default function ShortsAdminPage() {
  const toast = useToast();
  const [shorts, setShorts] = useState<Short[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  // Section background — singleton row in shorts_config (migration 26).
  const [bgConfigId, setBgConfigId] = useState<string | null>(null);
  const [bg, setBg] = useState<SectionBgValue>(EMPTY_BG);
  const [savingBg, setSavingBg] = useState(false);
  const [bgSaved, setBgSaved] = useState(false);
  // Migration 33 — admin-editable section title + style. Null fields
  // fall back to the pre-2026-06-10 hardcoded "BRAND SHORTS" / white /
  // 15px / transparent look so existing installs don't shift.
  const [headerText, setHeaderText] = useState('');
  const [headerFontSize, setHeaderFontSize] = useState('15');
  const [headerTextColor, setHeaderTextColor] = useState('#ffffff');
  const [headerBgEnabled, setHeaderBgEnabled] = useState(false);
  const [headerBgColor, setHeaderBgColor] = useState('#000000');
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerSaved, setHeaderSaved] = useState(false);

  useEffect(() => {
    fetchShorts();
    fetchProducts();
    fetchBg();
  }, []);

  async function fetchBg() {
    if (!supabase) return;
    const { data } = await supabase
      .from('shorts_config')
      .select('id, bg_type, bg_color, bg_media_url, bg_media_type, header_text, header_font_size, header_text_color, header_bg_color')
      .limit(1).maybeSingle();
    if (data) {
      setBgConfigId(data.id);
      setBg({
        type: data.bg_type ?? null,
        color: data.bg_color ?? null,
        mediaUrl: data.bg_media_url ?? null,
        mediaType: (data.bg_media_type as 'image' | 'video' | null) ?? null,
      });
      setHeaderText(data.header_text ?? '');
      setHeaderFontSize(String(parseInt(data.header_font_size ?? '15', 10) || 15));
      setHeaderTextColor(data.header_text_color ?? '#ffffff');
      setHeaderBgEnabled(!!data.header_bg_color);
      setHeaderBgColor(data.header_bg_color ?? '#000000');
    }
  }

  async function saveHeader() {
    if (!supabase) return;
    setSavingHeader(true);
    try {
      const size = Math.max(10, Math.min(48, parseInt(headerFontSize, 10) || 15));
      const payload = {
        header_text: headerText.trim() || null,
        header_font_size: `${size}px`,
        header_text_color: headerTextColor || null,
        header_bg_color: headerBgEnabled ? headerBgColor : null,
      };
      if (bgConfigId) {
        const { error } = await supabase.from('shorts_config').update(payload).eq('id', bgConfigId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('shorts_config').insert([payload]).select('id').single();
        if (error) throw error;
        setBgConfigId(data.id);
      }
      revalidateHomepageData('shorts');
      setHeaderSaved(true);
      setTimeout(() => setHeaderSaved(false), 2000);
    } catch (err) {
      console.error('[admin/shorts] header save failed:', err);
      toast.show('제목 스타일 저장에 실패했습니다.', 'error');
    } finally {
      setSavingHeader(false);
    }
  }

  async function saveBg() {
    if (!supabase) return;
    setSavingBg(true);
    try {
      const payload = {
        bg_type: bg.type,
        bg_color: bg.color,
        bg_media_url: bg.mediaUrl,
        bg_media_type: bg.mediaType,
      };
      if (bgConfigId) {
        const { error } = await supabase.from('shorts_config').update(payload).eq('id', bgConfigId);
        if (error) throw error;
      } else {
        // Seed row should already exist from the migration, but tolerate
        // its absence so a fresh project doesn't get stuck.
        const { data, error } = await supabase.from('shorts_config').insert([payload]).select('id').single();
        if (error) throw error;
        setBgConfigId(data.id);
      }
      revalidateHomepageData('shorts');
      setBgSaved(true);
      setTimeout(() => setBgSaved(false), 2000);
    } catch (err) {
      console.error('[admin/shorts] bg save failed:', err);
      toast.show('배경 저장에 실패했습니다.', 'error');
    } finally {
      setSavingBg(false);
    }
  }

  async function fetchProducts() {
    if (!supabase) return;
    const { data } = await supabase.from('products').select('id, name').eq('is_active', true).order('name');
    if (data) setProducts(data);
  }

  async function fetchShorts() {
    try {
      if (!supabase) throw new Error('Supabase 클라이언트 없음');
      const { data, error } = await supabase
        .from('shorts')
        .select('id, youtube_id, product_id, created_at, products(name)')
        .order('created_at', { ascending: false });
      if (error) throw error;
      type ShortsRow = {
        id: string;
        youtube_id: string;
        product_id: string | null;
        created_at: string;
        products: { name: string } | null;
      };
      setShorts(((data ?? []) as unknown as ShortsRow[]).map(d => ({
        id: d.id,
        youtubeId: d.youtube_id,
        productId: d.product_id || null,
        productName: d.products?.name || null,
        addedAt: new Date(d.created_at).toISOString().split('T')[0],
      })));
    } catch (err) {
      // Previously fell back to 4 hardcoded demo YouTube IDs which made
      // it impossible to tell whether the DB had real shorts or none.
      // Now surface the failure to the operator instead of masking it.
      console.error('[admin/shorts] DB fetch failed:', err);
      setShorts([]);
    } finally {
      setIsLoading(false);
    }
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!newUrl) return;

    const match = newUrl.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|shorts\/)([^"&?\/\s]{11})/);
    const videoId = match ? match[1] : (newUrl.length === 11 ? newUrl : null);

    if (videoId) {
      const tempId = Date.now().toString();
      setShorts(prev => [{ id: tempId, youtubeId: videoId, productId: null, productName: null, addedAt: new Date().toISOString().split('T')[0] }, ...prev]);
      setNewUrl('');
      try {
        if (!supabase) throw new Error('클라이언트 없음');
        const { error } = await supabase.from('shorts').insert([{ youtube_id: videoId }]);
        if (!error) {
          toast.show(`YouTube ID '${videoId}' 추가됨`, 'success');
          fetchShorts();
          revalidateHomepageData('shorts');
        }
      } catch { /* mock mode */ }
    } else {
      toast.show('유효하지 않은 YouTube URL 또는 ID입니다.', 'warning');
    }
  };

  const handleDelete = async (id: string) => {
    setShorts(prev => prev.filter(s => s.id !== id));
    try {
      if (!supabase) throw new Error('클라이언트 없음');
      await supabase.from('shorts').delete().eq('id', id);
      revalidateHomepageData('shorts');
    } catch { /* ignore */ }
  };

  const handleLinkProduct = async (shortId: string, productId: string | null) => {
    setLinkingId(shortId);
    try {
      if (supabase) {
        await supabase.from('shorts').update({ product_id: productId || null }).eq('id', shortId);
      }
      const prod = products.find(p => p.id === productId);
      setShorts(prev => prev.map(s => s.id === shortId ? { ...s, productId: productId, productName: prod?.name || null } : s));
      revalidateHomepageData('shorts');
    } catch { /* ignore */ }
    finally { setLinkingId(null); }
  };

  if (isLoading) return (
    <div className="p-10 animate-pulse bg-gray-100 rounded-xl h-64 flex items-center justify-center text-gray-400 font-bold tracking-widest">
      숏츠 불러오는 중...
    </div>
  );

  const linkedCount = shorts.filter(s => s.productId).length;
  const unlinkedCount = shorts.filter(s => !s.productId).length;

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 쇼츠" value={shorts.length} icon={Video} subLabel="등록된 영상" />
        <StatCard accent="#22c55e" label="상품 연결됨" value={linkedCount} icon={Link2} subLabel={`전체 ${shorts.length}개 중`} />
        <StatCard accent="#f59e0b" label="상품 미연결" value={unlinkedCount} icon={Package} subLabel="구매 유도 비활성" />
        <StatCard accent="#8b5cf6" label="활성 상품" value={products.length} icon={Package} subLabel="연결 가능한 상품" />
      </StatStrip>

      <PageHeader
        title="BRAND SHORTS 관리"
        description="홈 메인 가로 캐러셀로 노출되는 9:16 세로 영상을 관리합니다"
      />
      <ShortsHeaderStyleCard
        text={headerText}
        fontSize={headerFontSize}
        textColor={headerTextColor}
        bgEnabled={headerBgEnabled}
        bgColor={headerBgColor}
        isSaving={savingHeader}
        showSavedFlash={headerSaved}
        onTextChange={setHeaderText}
        onFontSizeChange={setHeaderFontSize}
        onTextColorChange={setHeaderTextColor}
        onBgEnabledChange={setHeaderBgEnabled}
        onBgColorChange={setHeaderBgColor}
        onSave={saveHeader}
      />

      {/* 섹션 배경 설정 (migration 26) */}
      <SectionBgCard
        value={bg}
        onChange={setBg}
        defaultColor="#171717"
        uploadPathPrefix="shorts-bg"
        isSaving={savingBg}
        showSavedFlash={bgSaved}
        onSave={saveBg}
        hint="기본값은 검정(neutral-900) 배경입니다."
      />

      {/* 새 숏츠 추가 */}
      <div className="bg-white rounded border border-[#e5e7eb] p-5">
        <h2 className="text-[14px] font-bold text-[#1f2937] mb-4 flex items-center gap-2">
          <Video className="w-5 h-5 text-purple-500" /> 새 브랜드 숏츠 추가
        </h2>
        <form onSubmit={handleAdd} className="flex gap-4">
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="YouTube Shorts URL 또는 영상 ID 붙여넣기 (예: ho0EhuO3RNs)"
            className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-black/5"
          />
          <button type="submit" className="bg-[#3b82f6] text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-[#2563eb] transition-colors whitespace-nowrap flex items-center gap-2">
            <Plus className="w-4 h-4" /> 피드에 추가
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-3">홈페이지에 최대 10개까지 자동으로 표시됩니다.</p>
      </div>

      <ShortsGrid
        shorts={shorts}
        products={products}
        linkingId={linkingId}
        onDelete={handleDelete}
        onLinkProduct={handleLinkProduct}
      />
    </div>
  );
}
