'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Video, Trash2, Plus, Link as LinkIcon, Save, Link2, Package } from 'lucide-react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, StatStrip, PageHeader } from '@/components/admin/CafeWidgets';
import { useToast } from '@/components/admin/Toast';
import SectionBackgroundPanel, { type SectionBgValue } from '@/components/admin/SectionBackgroundPanel';

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

      {/* 섹션 제목 스타일 (migration 33) */}
      <div className="bg-white rounded border border-[#e5e7eb] p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-bold text-[#1f2937]">섹션 제목</h2>
          <p className="text-xs text-gray-400">기본은 &ldquo;BRAND SHORTS&rdquo; · 흰색 · 15px.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">제목 텍스트</label>
            <input
              type="text"
              value={headerText}
              onChange={e => setHeaderText(e.target.value)}
              placeholder="BRAND SHORTS"
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">비워두면 기본값 &ldquo;BRAND SHORTS&rdquo;가 표시됩니다.</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">글자 크기 (px)</label>
            <input
              type="number"
              min={10}
              max={48}
              step={1}
              value={headerFontSize}
              onChange={e => setHeaderFontSize(e.target.value)}
              className="w-full mt-1 px-3 py-2 text-sm border border-gray-200 rounded focus:outline-none focus:border-gray-400"
            />
            <p className="text-[10px] text-gray-400 mt-1">10–48 사이. 기본 15.</p>
          </div>
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">글자 색상</label>
            <div className="flex items-center gap-2 mt-1">
              <input
                type="color"
                value={headerTextColor}
                onChange={e => setHeaderTextColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0"
              />
              <input
                type="text"
                value={headerTextColor}
                onChange={e => setHeaderTextColor(e.target.value)}
                className="flex-1 px-3 py-2 text-sm font-mono border border-gray-200 rounded focus:outline-none focus:border-gray-400"
              />
            </div>
          </div>
          <div>
            <label className="flex items-center gap-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider cursor-pointer">
              <input
                type="checkbox"
                checked={headerBgEnabled}
                onChange={e => setHeaderBgEnabled(e.target.checked)}
                className="w-3.5 h-3.5"
              />
              제목 뒤 배경 색상 사용
            </label>
            <div className={`flex items-center gap-2 mt-1 ${!headerBgEnabled ? 'opacity-40 pointer-events-none' : ''}`}>
              <input
                type="color"
                value={headerBgColor}
                onChange={e => setHeaderBgColor(e.target.value)}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer p-0"
              />
              <input
                type="text"
                value={headerBgColor}
                onChange={e => setHeaderBgColor(e.target.value)}
                className="flex-1 px-3 py-2 text-sm font-mono border border-gray-200 rounded focus:outline-none focus:border-gray-400"
              />
            </div>
            <p className="text-[10px] text-gray-400 mt-1">체크 해제 시 섹션 배경 위에 그대로 노출됩니다.</p>
          </div>
        </div>

        {/* Live preview chip so the admin sees the combined effect
            without scrolling to the storefront iframe. */}
        <div className="pt-3 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">미리보기</p>
          <div className="flex justify-center py-6 bg-neutral-900 rounded">
            <h3
              className="font-bold tracking-widest uppercase"
              style={{
                color: headerTextColor,
                fontSize: `${Math.max(10, Math.min(48, parseInt(headerFontSize, 10) || 15))}px`,
                backgroundColor: headerBgEnabled ? headerBgColor : undefined,
                padding: headerBgEnabled ? '0.5rem 1rem' : undefined,
                borderRadius: headerBgEnabled ? '0.25rem' : undefined,
              }}
            >
              {headerText.trim() || 'BRAND SHORTS'}
            </h3>
          </div>
        </div>

        <button
          onClick={saveHeader}
          disabled={savingHeader}
          className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            headerSaved ? 'bg-green-600 text-white' : 'bg-black/80 text-white hover:bg-black'
          } disabled:opacity-50`}
        >
          <Save className="w-3.5 h-3.5" />
          {savingHeader ? '저장 중...' : headerSaved ? '✓ 저장 완료' : '제목 스타일 저장'}
        </button>
      </div>

      {/* 섹션 배경 설정 (migration 26) */}
      <div className="bg-white rounded border border-[#e5e7eb] p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-bold text-[#1f2937]">섹션 배경</h2>
          <p className="text-xs text-gray-400">기본값은 검정(neutral-900) 배경입니다.</p>
        </div>
        <SectionBackgroundPanel
          value={bg}
          onChange={setBg}
          defaultColor="#171717"
          uploadPathPrefix="shorts-bg"
        />
        <button
          onClick={saveBg}
          disabled={savingBg}
          className={`px-5 py-2 rounded-lg text-xs font-semibold transition-all flex items-center gap-2 ${
            bgSaved ? 'bg-green-600 text-white' : 'bg-black/80 text-white hover:bg-black'
          } disabled:opacity-50`}
        >
          <Save className="w-3.5 h-3.5" />
          {savingBg ? '저장 중...' : bgSaved ? '✓ 저장 완료' : '배경 저장'}
        </button>
      </div>

      {/* 새 숏츠 추가 */}
      <div className="bg-white rounded border border-[#e5e7eb] p-6">
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

      {/* 현재 게시 중인 숏츠 */}
      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-[14px] font-bold text-[#1f2937]">현재 스토어에 게시 중</h2>
          <span className="text-sm font-medium text-gray-500">{shorts.length}개 항목</span>
        </div>

        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-6">
          {shorts.map((short) => (
            <div key={short.id} className="relative group rounded-xl overflow-hidden border border-gray-200 bg-gray-50">
              <div className="relative aspect-[9/16] w-full">
                <Image
                  src={`https://i.ytimg.com/vi/${short.youtubeId}/hqdefault.jpg`}
                  alt="썸네일"
                  fill
                  sizes="(max-width: 768px) 50vw, 25vw"
                  className="object-cover"
                />
              </div>
              <div className="absolute top-0 left-0 right-0 p-3 bg-gradient-to-b from-black/60 to-transparent flex justify-between items-start">
                <span className="text-[10px] text-white font-mono bg-black/50 px-2 py-1 rounded backdrop-blur-sm">{short.youtubeId}</span>
                <button
                  onClick={() => handleDelete(short.id)}
                  className="w-8 h-8 rounded-full bg-red-500 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600 shadow-md"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Product link selector */}
              <div className="p-2 border-t border-gray-100">
                <label className="text-[9px] font-bold text-gray-400 uppercase tracking-wide flex items-center gap-1 mb-1">
                  <LinkIcon className="w-2.5 h-2.5" /> 연결 제품
                </label>
                <select
                  value={short.productId || ''}
                  onChange={e => handleLinkProduct(short.id, e.target.value || null)}
                  disabled={linkingId === short.id}
                  className="w-full text-[11px] border border-gray-200 rounded px-1.5 py-1 bg-white focus:outline-none focus:border-black transition disabled:opacity-50"
                >
                  <option value="">연결 없음</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
                {short.productName && (
                  <p className="text-[10px] text-green-600 font-semibold mt-1 truncate">✓ {short.productName}</p>
                )}
              </div>

              <div className="px-3 pb-2 text-xs text-gray-500 font-medium">추가일: {short.addedAt}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
