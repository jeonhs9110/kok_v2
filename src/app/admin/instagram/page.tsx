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
  sort_order: number;
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

const emptyPost = (i: number): IgPost => ({ id: null, image_url: '', link_url: '', sort_order: i });

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
    if (!post.image_url) return;
    setSavingSlot(slot);
    try {
      const payload = { image_url: post.image_url, link_url: post.link_url, sort_order: slot, is_active: true };
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
        <h2 className="text-lg font-bold text-gray-800 mb-1">피드 이미지 (최대 6개)</h2>
        <p className="text-sm text-gray-500 mb-6">홈페이지에 표시될 인스타그램 피드 이미지를 업로드하세요. 각 이미지에 클릭 링크를 설정할 수 있습니다.</p>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {posts.map((post, slot) => (
            <div key={slot} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Image slot */}
              <div
                className="relative aspect-square bg-gray-50 cursor-pointer group flex items-center justify-center border-b border-gray-100"
                onClick={() => {
                  activeSlotRef.current = slot;
                  fileInputRef.current?.click();
                }}
              >
                {post.image_url ? (
                  <>
                    <img src={post.image_url} alt="" className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                      <Upload className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-gray-300 group-hover:text-gray-500 transition-colors">
                    {uploadingSlot === slot
                      ? <div className="w-7 h-7 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                      : <><ImageIcon className="w-8 h-8" /><span className="text-xs font-semibold">이미지 {slot + 1}</span></>}
                  </div>
                )}
                <span className="absolute top-2 left-2 bg-black/50 text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                  {slot + 1}
                </span>
                {post.image_url && (
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); deletePost(slot); }}
                    className="absolute top-2 right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>

              {/* Link + save */}
              <div className="p-3 space-y-2">
                <input
                  type="text"
                  value={post.link_url}
                  onChange={e => setPosts(prev => prev.map((p, i) => i === slot ? { ...p, link_url: e.target.value } : p))}
                  placeholder="클릭 링크 URL (선택)"
                  className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-gray-50 focus:bg-white focus:border-black outline-none transition"
                />
                <button
                  onClick={() => savePost(slot)}
                  disabled={savingSlot === slot || !post.image_url}
                  className="w-full bg-[#111] text-white py-1.5 rounded text-xs font-bold tracking-widest hover:bg-black transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1"
                >
                  {savingSlot === slot
                    ? <><div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />저장 중</>
                    : <><Save className="w-3 h-3" />저장</>}
                </button>
              </div>
            </div>
          ))}
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
