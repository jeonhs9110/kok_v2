'use client';
import { useState, useEffect } from 'react';
import Image from 'next/image';
import { Video, Trash2, Plus, Link as LinkIcon } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';
import { revalidateHomepageData } from '@/lib/cache/invalidate';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
  const [shorts, setShorts] = useState<Short[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [newUrl, setNewUrl] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [linkingId, setLinkingId] = useState<string | null>(null);

  useEffect(() => {
    fetchShorts();
    fetchProducts();
  }, []);

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
          alert(`YouTube ID '${videoId}' 가 홈페이지에 추가되었습니다.`);
          fetchShorts();
          revalidateHomepageData('shorts');
        }
      } catch { /* mock mode */ }
    } else {
      alert('유효하지 않은 YouTube URL 또는 ID입니다.');
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

  return (
    <div className="space-y-8">
      {/* 새 숏츠 추가 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
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
          <button type="submit" className="bg-[#111111] text-white px-6 py-3 rounded-lg text-sm font-semibold hover:bg-black transition-colors whitespace-nowrap flex items-center gap-2">
            <Plus className="w-4 h-4" /> 피드에 추가
          </button>
        </form>
        <p className="text-xs text-gray-400 mt-3">홈페이지에 최대 10개까지 자동으로 표시됩니다.</p>
      </div>

      {/* 현재 게시 중인 숏츠 */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
          <h2 className="text-lg font-bold text-gray-800">현재 스토어에 게시 중</h2>
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
