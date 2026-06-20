'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';
import { Upload, Trash2, ImageIcon, Save, RefreshCw, ExternalLink } from 'lucide-react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import SectionBackgroundPanel, { type SectionBgValue } from '@/components/admin/SectionBackgroundPanel';
import { useToast } from '@/components/admin/Toast';
import { PageHeader, LoadingState } from '@/components/admin/CafeWidgets';

const EMPTY_BG: SectionBgValue = { type: null, color: null, mediaUrl: null, mediaType: null };

// Session-aware client. Phase 2 RLS lockdown on `instagram_posts` requires admin JWT.
const supabase = getSupabaseBrowser();
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
  const toast = useToast();
  const [handle, setHandle] = useState('');
  const [description, setDescription] = useState('');
  const [rssFeedUrl, setRssFeedUrl] = useState('');
  const [posts, setPosts] = useState<IgPost[]>(Array.from({ length: SLOTS }, (_, i) => emptyPost(i)));
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [uploadingSlot, setUploadingSlot] = useState<number | null>(null);
  const [savingSlot, setSavingSlot] = useState<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeSlotRef = useRef<number | null>(null);
  // Section background — instagram_config columns added in migration 26.
  const [bg, setBg] = useState<SectionBgValue>(EMPTY_BG);
  const [savingBg, setSavingBg] = useState(false);
  const [bgSaved, setBgSaved] = useState(false);
  // Migration 34 — admin-editable @handle line style. Null fields fall
  // back to the pre-2026-06-10 look (18px / neutral-800 / no plate).
  const [headerFontSize, setHeaderFontSize] = useState('18');
  const [headerTextColor, setHeaderTextColor] = useState('#262626');
  const [headerBgEnabled, setHeaderBgEnabled] = useState(false);
  const [headerBgColor, setHeaderBgColor] = useState('#ffffff');
  const [savingHeader, setSavingHeader] = useState(false);
  const [headerSaved, setHeaderSaved] = useState(false);

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
        setHandle(configRes.data.handle || '');
        setDescription(configRes.data.description || '');
        setRssFeedUrl(configRes.data.rss_feed_url || '');
        setBg({
          type: configRes.data.bg_type ?? null,
          color: configRes.data.bg_color ?? null,
          mediaUrl: configRes.data.bg_media_url ?? null,
          mediaType: (configRes.data.bg_media_type as 'image' | 'video' | null) ?? null,
        });
        setHeaderFontSize(String(parseInt(configRes.data.header_font_size ?? '18', 10) || 18));
        setHeaderTextColor(configRes.data.header_text_color ?? '#262626');
        setHeaderBgEnabled(!!configRes.data.header_bg_color);
        setHeaderBgColor(configRes.data.header_bg_color ?? '#ffffff');
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
      await supabase.from('instagram_config').upsert({ id: 1, handle, description, rss_feed_url: rssFeedUrl, updated_at: new Date().toISOString() });
      revalidateHomepageData('instagram');
      toast.show('인스타그램 설정이 저장되었습니다', 'success');
    } catch { toast.show('저장에 실패했습니다.', 'error'); }
    finally { setIsSavingConfig(false); }
  };

  async function saveHeader() {
    if (!supabase) return;
    setSavingHeader(true);
    try {
      const size = Math.max(10, Math.min(48, parseInt(headerFontSize, 10) || 18));
      const { error } = await supabase.from('instagram_config').upsert({
        id: 1,
        header_font_size: `${size}px`,
        header_text_color: headerTextColor || null,
        header_bg_color: headerBgEnabled ? headerBgColor : null,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      revalidateHomepageData('instagram');
      setHeaderSaved(true);
      setTimeout(() => setHeaderSaved(false), 2000);
    } catch (err) {
      console.error('[admin/instagram] header save failed:', err);
      toast.show('제목 스타일 저장에 실패했습니다.', 'error');
    } finally {
      setSavingHeader(false);
    }
  }

  async function saveBg() {
    if (!supabase) return;
    setSavingBg(true);
    try {
      // Bg columns live on the same singleton row instagram_config uses
      // for handle / description; piggyback the existing id=1 convention.
      const { error } = await supabase.from('instagram_config').upsert({
        id: 1,
        bg_type: bg.type,
        bg_color: bg.color,
        bg_media_url: bg.mediaUrl,
        bg_media_type: bg.mediaType,
        updated_at: new Date().toISOString(),
      });
      if (error) throw error;
      revalidateHomepageData('instagram');
      setBgSaved(true);
      setTimeout(() => setBgSaved(false), 2000);
    } catch (err) {
      console.error('[admin/instagram] bg save failed:', err);
      toast.show('배경 저장에 실패했습니다.', 'error');
    } finally {
      setSavingBg(false);
    }
  }

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
    } catch { toast.show('이미지 업로드에 실패했습니다.', 'error'); }
    finally { setUploadingSlot(null); }
  };

  const savePost = async (slot: number) => {
    if (!supabase) return;
    const post = posts[slot];
    // Must have either image or post URL
    if (!post.image_url && !post.post_url) return;
    // Validate post URL if provided
    if (post.post_url && !extractPostId(post.post_url)) {
      toast.show('유효한 Instagram 포스트 URL이 아닙니다. 예: https://www.instagram.com/p/ABC123/', 'warning');
      return;
    }
    setSavingSlot(slot);
    try {
      const payload = { image_url: post.image_url, link_url: post.link_url, post_url: post.post_url, sort_order: slot, is_active: true };
      if (post.id) {
        const { error } = await supabase.from('instagram_posts').update(payload).eq('id', post.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from('instagram_posts').insert([payload]).select().single();
        if (error) throw error;
        setPosts(prev => prev.map((p, i) => i === slot ? { ...p, id: data.id } : p));
      }
      revalidateHomepageData('instagram');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('Instagram save error:', err);
      toast.show(`저장 실패: ${msg}`, 'error');
      console.warn('[admin/instagram] If this is a missing-column error, run: ALTER TABLE public.instagram_posts ADD COLUMN IF NOT EXISTS post_url text DEFAULT \'\';');
    }
    finally { setSavingSlot(null); }
  };

  const deletePost = async (slot: number) => {
    const post = posts[slot];
    if (post.id && supabase) {
      await supabase.from('instagram_posts').delete().eq('id', post.id);
      revalidateHomepageData('instagram');
    }
    setPosts(prev => prev.map((p, i) => i === slot ? emptyPost(i) : p));
  };

  const handleRefresh = async () => {
    if (!rssFeedUrl.trim()) {
      setRefreshMessage({ type: 'error', text: 'RSS 피드 URL을 먼저 입력하고 설정을 저장해주세요.' });
      return;
    }
    setIsRefreshing(true);
    setRefreshMessage(null);
    try {
      const res = await fetch('/api/instagram/refresh', { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        setRefreshMessage({ type: 'error', text: data.error || '새로고침 실패' });
        return;
      }
      const urls: string[] = data.urls || [];
      setPosts(prev => prev.map((p, i) => ({
        ...p,
        post_url: urls[i] || p.post_url,
      })));
      const { added, removed, unchanged } = data.stats || {};
      setRefreshMessage({
        type: 'success',
        text: `✓ ${urls.length}개 포스트 가져옴 — 신규 ${added}, 동일 ${unchanged}, 제거 ${removed}. "저장" 버튼을 눌러 확정하세요.`,
      });
    } catch {
      setRefreshMessage({ type: 'error', text: '새로고침 중 오류가 발생했습니다.' });
    } finally {
      setIsRefreshing(false);
    }
  };

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-5">
      <PageHeader
        title="인스타그램"
        description="@핸들 · 자동 RSS 새로고침 · 홈 메인에 노출되는 포스트를 관리합니다"
      />

      {/* Config card */}
      <div className="bg-white rounded border border-[#e5e7eb] p-6">
        <div className="flex items-center gap-2 mb-4">
          <IgIcon className="w-5 h-5 text-[#E1306C]" />
          <h2 className="text-[14px] font-bold text-[#1f2937]">인스타그램 설정</h2>
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
            className="bg-[#3b82f6] text-white px-6 py-2 rounded text-sm font-bold tracking-widest hover:bg-[#2563eb] transition disabled:opacity-40 flex items-center gap-2"
          >
            {isSavingConfig ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />저장 중...</> : <><Save className="w-4 h-4" />설정 저장</>}
          </button>
        </div>
      </div>

      {/* 섹션 제목 스타일 (migration 34) */}
      <div className="bg-white rounded border border-[#e5e7eb] p-6 space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-[14px] font-bold text-[#1f2937]">섹션 제목 (@핸들) 스타일</h2>
          <p className="text-xs text-gray-400">기본은 18px · 짙은 회색 · 배경 없음.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            <p className="text-[10px] text-gray-400 mt-1">10–48 사이. 기본 18.</p>
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
          <div className="md:col-span-2">
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

        <div className="pt-3 border-t border-gray-100">
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">미리보기</p>
          <div className="flex justify-center py-6 bg-neutral-50 rounded">
            <div
              className="flex items-center gap-2 font-bold tracking-wide"
              style={{
                color: headerTextColor,
                fontSize: `${Math.max(10, Math.min(48, parseInt(headerFontSize, 10) || 18))}px`,
                backgroundColor: headerBgEnabled ? headerBgColor : undefined,
                padding: headerBgEnabled ? '0.5rem 1rem' : undefined,
                borderRadius: headerBgEnabled ? '0.375rem' : undefined,
              }}
            >
              <IgIcon className="w-6 h-6" />
              <span>@{handle || 'your_handle'}</span>
            </div>
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
          <p className="text-xs text-gray-400">기본값은 페이지 배경(투명)입니다.</p>
        </div>
        <SectionBackgroundPanel
          value={bg}
          onChange={setBg}
          defaultColor="#ffffff"
          uploadPathPrefix="instagram-bg"
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

      {/* RSS Auto-Refresh card */}
      <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl shadow-sm border border-purple-200 p-6">
        <div className="flex items-center gap-2 mb-2">
          <RefreshCw className="w-5 h-5 text-purple-600" />
          <h2 className="text-[14px] font-bold text-[#1f2937]">RSS 자동 새로고침</h2>
          {rssFeedUrl && <span className="text-[10px] font-bold bg-green-500 text-white px-2 py-0.5 rounded-full">설정됨</span>}
        </div>
        <p className="text-sm text-gray-600 mb-4">
          RSS.app에서 생성한 Instagram RSS 피드 URL을 입력하면 <strong>새로고침 버튼 한 번으로</strong> 최신 포스트 6개를 자동으로 가져옵니다.
        </p>

        <div className="bg-white/80 border border-purple-200 rounded-lg p-3 mb-4 text-xs text-gray-700 space-y-1">
          <p className="font-bold text-purple-800">RSS.app 설정 방법 (5분):</p>
          <ol className="list-decimal ml-4 space-y-0.5">
            <li><a href="https://rss.app/new-rss-feed" target="_blank" rel="noopener noreferrer" className="text-purple-600 underline font-semibold inline-flex items-center gap-0.5">rss.app/new-rss-feed <ExternalLink className="w-2.5 h-2.5" /></a>에서 무료 가입</li>
            <li>&quot;Instagram&quot; 선택 → Instagram 프로필 URL 입력: <code className="bg-purple-100 px-1 rounded">https://www.instagram.com/{handle}/</code></li>
            <li>Generate Feed → RSS URL 복사 (예: <code className="bg-purple-100 px-1 rounded">https://rss.app/feeds/ABC123.xml</code>)</li>
            <li>아래에 붙여넣고 <strong>설정 저장</strong> 후 <strong>새로고침</strong> 버튼 클릭</li>
          </ol>
          <p className="pt-1 text-[11px] text-gray-500">💡 무료 플랜: 6시간마다 자동 업데이트, 피드 2개까지. 관리자가 수동으로 새로고침 버튼을 누를 때마다 최신화됩니다.</p>
        </div>

        <div className="flex gap-2 mb-3">
          <input
            type="url"
            value={rssFeedUrl}
            onChange={e => setRssFeedUrl(e.target.value)}
            placeholder="https://rss.app/feeds/xxxxxxxx.xml"
            className="flex-1 border border-purple-200 rounded px-3 py-2.5 text-sm bg-white focus:border-purple-500 outline-none transition font-mono"
          />
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || !rssFeedUrl.trim()}
            className="bg-gradient-to-r from-purple-600 to-pink-600 text-white px-5 py-2.5 rounded font-bold text-sm hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 whitespace-nowrap"
          >
            {isRefreshing ? (
              <><RefreshCw className="w-4 h-4 animate-spin" />가져오는 중...</>
            ) : (
              <><RefreshCw className="w-4 h-4" />새로고침</>
            )}
          </button>
        </div>

        {refreshMessage && (
          <div className={`text-xs px-3 py-2 rounded-lg font-medium ${
            refreshMessage.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-800'
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            {refreshMessage.text}
          </div>
        )}
      </div>

      {/* Posts grid */}
      <div className="bg-white rounded border border-[#e5e7eb] p-6">
        <h2 className="text-[14px] font-bold text-[#1f2937] mb-1">인스타그램 포스트 (최대 6개)</h2>
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
                    <Image src={post.image_url} alt="" fill sizes="(max-width: 768px) 100vw, 33vw" className="object-cover" />
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
                    className="w-full bg-[#3b82f6] text-white py-1.5 rounded text-xs font-bold tracking-widest hover:bg-[#2563eb] transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 mt-2"
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
