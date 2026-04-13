'use client';

import { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Upload, Trash2, ImageIcon, Save } from 'lucide-react';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
const BUCKET = 'product-images';
const SLOTS = 6;

interface IgPost {
  id: string | null;
  image_url: string;
  link_url: string;
  post_url: string;
  sort_order: number;
}

// Extract post ID from Instagram URL (handles p/, reel/, tv/)
function extractPostId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

function IgIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

const emptyPost = (i: number): IgPost => ({ id: null, image_url: '', link_url: '', post_url: '', sort_order: i });

export default function InstagramAdminPage() {
  const [handle, setHandle] = useState('rdrd_official');
  const [description, setDescription] = useState('인스타그램에서 최신 소식을 확인하세요');
  const [posts, setPosts] = useState<IgPost[]>(Array.from({ length: SLOTS }, (_, i) => emptyPost(i)));
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<number | null>(null);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('no client');
      const [configRes, postsRes] = await Promise.all([
        supabase.from('instagram_config').select('*').single(),
        supabase.from('instagram_posts').select('*').order('sort_order').limit(SLOTS),
      ]);
      if (configRes.data) {
        setHandle(configRes.data.handle || 'rdrd_official');
        setDescription(configRes.data.description || '');
      }
      const fetched = postsRes.data || [];
      const filled = Array.from({ length: SLOTS }, (_, i) => fetched[i] ? {
        id: fetched[i].id,
        image_url: fetched[i].image_url,
        link_url: fetched[i].link_url || '',
        post_url: fetched[i].post_url || '',
        sort_order: i,
      } : emptyPost(i));
      setPosts(filled);
    } catch { /* use defaults */ }
    finally { setIsLoading(false); }
  }

  const saveConfig = async () => {
    if (!supabase) return;
    setIsSavingConfig(true);
    try {
      await supabase.from('instagram_config').upsert({ id: 1, handle, description, updated_at: new Date().toISOString() });
      alert('인스타그램 설정이 저장되었습니다.');
    } catch { alert('저장에 실패했습니다.'); }
    finally { setIsSavingConfig(false); }
  };

  const uploadImage = async (file: File, slot: number) => {
    if (!supabase) return;
    setUploadingSlot(slot);
    try {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const fileName = `instagram/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
      setPosts(prev => prev.map((p, i) => i === slot ? { ...p, image_url: urlData.publicUrl } : p));
    } catch { alert('이미지 업로드에 실패했습니다.'); }
    finally { setUploadingSlot(null); }
  };

  const savePost = async (slot: number) => {
    if (!supabase) return;
    const post = posts[slot];
    // Must have either image or post URL
    if (!post.image_url && !post.post_url) return;
    // Validate post URL if provided
    if (post.post_url && !extractPostId(post.post_url)) {
      alert('유효한 Instagram 포스트 URL이 아닙니다.\n예: https://www.instagram.com/p/ABC123/');
      return;
    }
    setSavingSlot(slot);
    try {
      const payload = { image_url: post.image_url, link_url: post.link_url, post_url: post.post_url, sort_order: slot, is_active: true };
      if (post.id) {
        await supabase.from('instagram_posts').update(payload).eq('id', post.id);
      } else {
        const { data, error } = await supabase.from('instagram_posts').insert([payload]).select().single();
        if (error) throw error;
        setPosts(prev => prev.map((p, i) => i === slot ? { ...p, id: data.id } : p));
      }
    } catch { alert('저장에 실패했습니다.'); }
    finally { setSavingSlot(null); }
  };

  const deletePost = async (slot: number) => {
    const post = posts[slot];
    if (post.id && supabase) {
      await supabase.from('instagram_posts').delete().eq('id', post.id);
    }
    setPosts(prev => prev.map((p, i) => i === slot ? emptyPost(i) : p));
  };

  if (isLoading) return (
    <div className="p-10 text-center text-gray-400 font-bold tracking-widest animate-pulse">불러오는 중...</div>
  );

  return (
    <div className="space-y-6">

      {/* Config card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <div className="flex items-center gap-2 mb-4">
          <IgIcon className="w-5 h-5 text-[#E1306C]" />
          <h2 className="text-lg font-bold text-gray-800">인스타그램 설정</h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          <div className="space-y-1">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">계정 핸들 (@없이 입력)</label>
            <div className="flex items-center border border-gray-200 rounded bg-gray-50 focus-within:border-black transition overflow-hidden">
              <span className="px-3 text-gray-400 font-semibold text-sm select-none">@</span>
              <input
                type="text"
                value={handle}
                onChange={e => setHandle(e.target.value.replace('@', ''))}
                placeholder="rdrd_official"
                className="flex-1 py-2 pr-3 text-sm bg-transparent outline-none"
              />
            </div>
          </div>
          <div className="space-y-1">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">설명 문구</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="인스타그램에서 최신 소식을 확인하세요"
              className="w-full border border-gray-200 rounded px-3 py-2 text-sm bg-gray-50 focus:bg-white focus:border-black outline-none transition"
            />
          </div>
        </div>

        <div className="flex items-center justify-between">
          <a
            href={`https://www.instagram.com/${handle}/`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-blue-500 hover:underline"
          >
            instagram.com/{handle} →
          </a>
          <button
            onClick={saveConfig}
            disabled={isSavingConfig}
            className="bg-[#111] text-white px-6 py-2 rounded text-sm font-bold tracking-widest hover:bg-black transition disabled:opacity-40 flex items-center gap-2"
          >
            {isSavingConfig ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />저장 중...</> : <><Save className="w-4 h-4" />설정 저장</>}
          </button>
        </div>
      </div>

      {/* Posts grid */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-1">인스타그램 포스트 (최대 6개)</h2>
        <p className="text-sm text-gray-500 mb-3">홈페이지에 표시될 포스트를 설정하세요. <strong>Instagram 포스트 URL을 붙여넣으면</strong> 실시간 공식 임베드가 표시됩니다 (이미지, 캡션, 좋아요 포함).</p>

        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-5 text-xs text-blue-800 space-y-1">
          <p className="font-bold">사용 방법:</p>
          <ol className="list-decimal ml-4 space-y-0.5">
            <li>Instagram에서 표시하고 싶은 포스트로 이동 (예: <code className="bg-blue-100 px-1 rounded">instagram.com/{handle}</code>)</li>
            <li>포스트 URL 복사 (예: <code className="bg-blue-100 px-1 rounded">https://www.instagram.com/p/ABC123/</code>)</li>
            <li>아래 슬롯에 붙여넣고 저장 → 홈페이지에 공식 임베드 표시</li>
          </ol>
          <p className="pt-1 text-[11px]">💡 지원: 일반 포스트 (p/), 릴스 (reel/), IGTV (tv/). URL만 바꾸면 홈페이지도 자동 업데이트됩니다.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {posts.map((post, slot) => {
            const postId = extractPostId(post.post_url);
            const hasEmbed = !!postId;
            return (
              <div key={slot} className={`border rounded-xl overflow-hidden ${hasEmbed ? 'border-pink-300 bg-pink-50/30' : 'border-gray-200'}`}>
                {/* Preview */}
                <div className="relative aspect-square bg-gray-50 flex items-center justify-center border-b border-gray-100 overflow-hidden">
                  {hasEmbed ? (
                    <iframe
                      src={`https://www.instagram.com/p/${postId}/embed/`}
                      scrolling="no"
                      className="w-full h-full"
                      style={{ border: 'none', overflow: 'hidden' }}
                      loading="lazy"
                    />
                  ) : post.image_url ? (
                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-gray-300">
                      {uploadingSlot === slot
                        ? <div className="w-7 h-7 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                        : <><ImageIcon className="w-8 h-8" /><span className="text-xs font-semibold">포스트 {slot + 1}</span></>}
                    </div>
                  )}
                  <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-bold px-1.5 py-0.5 rounded pointer-events-none">
                    {slot + 1}
                  </span>
                  {hasEmbed && (
                    <span className="absolute top-2 right-2 bg-gradient-to-r from-[#E1306C] to-[#F56040] text-white text-[10px] font-bold px-2 py-0.5 rounded pointer-events-none">
                      LIVE
                    </span>
                  )}
                  {(post.post_url || post.image_url) && (
                    <button
                      type="button"
                      onClick={() => deletePost(slot)}
                      className="absolute bottom-2 right-2 w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 shadow-md"
                      title="삭제"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                {/* Inputs */}
                <div className="p-3 space-y-2">
                  <div>
                    <label className="text-[10px] font-bold text-pink-600 uppercase tracking-wider flex items-center gap-1 mb-1">
                      <IgIcon className="w-3 h-3" />
                      Instagram 포스트 URL
                    </label>
                    <input
                      type="url"
                      value={post.post_url}
                      onChange={e => setPosts(prev => prev.map((p, i) => i === slot ? { ...p, post_url: e.target.value } : p))}
                      placeholder="https://www.instagram.com/p/..."
                      className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50 focus:bg-white focus:border-pink-400 outline-none transition font-mono"
                    />
                  </div>

                  {!hasEmbed && (
                    <>
                      <div className="text-center text-[10px] text-gray-400 font-semibold py-1">또는</div>
                      <button
                        type="button"
                        onClick={() => { activeSlotRef.current = slot; fileInputRef.current?.click(); }}
                        className="w-full border border-dashed border-gray-300 rounded py-1.5 text-xs text-gray-500 hover:border-gray-500 hover:text-gray-700 transition flex items-center justify-center gap-1"
                      >
                        <Upload className="w-3 h-3" />
                        {post.image_url ? '이미지 변경' : '이미지 직접 업로드'}
                      </button>
                    </>
                  )}

                  <button
                    onClick={() => savePost(slot)}
                    disabled={savingSlot === slot || (!post.image_url && !post.post_url)}
                    className="w-full bg-[#111] text-white py-1.5 rounded text-xs font-bold tracking-widest hover:bg-black transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 mt-2"
                  >
                    {savingSlot === slot
                      ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />저장 중</>
                      : <><Save className="w-3 h-3" />저장</>}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0];
          const slot = activeSlotRef.current;
          if (!file || slot === null) return;
          await uploadImage(file, slot);
          e.target.value = '';
        }}
      />
    </div>
  );
}
