'use client';

import { useState, useEffect } from 'react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import type { SectionBgValue } from '@/components/admin/SectionBackgroundPanel';
import SectionBgCard from '@/components/admin/SectionBgCard';
import { useToast } from '@/components/admin/Toast';
import { PageHeader, LoadingState } from '@/components/admin/CafeWidgets';
import InstagramConfigCard from './_components/InstagramConfigCard';
import InstagramHeaderStyleCard from './_components/InstagramHeaderStyleCard';
import InstagramRssCard from './_components/InstagramRssCard';
import InstagramPostsGrid, { type IgPost } from './_components/InstagramPostsGrid';

const EMPTY_BG: SectionBgValue = { type: null, color: null, mediaUrl: null, mediaType: null };

// Session-aware client. Phase 2 RLS lockdown on `instagram_posts` requires admin JWT.
const supabase = getSupabaseBrowser();
const BUCKET = 'product-images';
const SLOTS = 6;

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
  // Section background — instagram_config columns added in migration 26.

  // Validation helper — same regex as the embed iframe in PostsGrid.
  function extractPostId(url: string): string | null {
    const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
    return match ? match[1] : null;
  }
  // Above declaration is only used by the validation guard below; the
  // PostsGrid component has its own copy for rendering the embed src.
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

  const uploadImage = async (slot: number, file: File) => {
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

      <InstagramConfigCard
        handle={handle}
        description={description}
        isSaving={isSavingConfig}
        onHandleChange={setHandle}
        onDescriptionChange={setDescription}
        onSave={saveConfig}
      />

      <InstagramHeaderStyleCard
        handle={handle}
        fontSize={headerFontSize}
        textColor={headerTextColor}
        bgEnabled={headerBgEnabled}
        bgColor={headerBgColor}
        isSaving={savingHeader}
        showSavedFlash={headerSaved}
        onFontSizeChange={setHeaderFontSize}
        onTextColorChange={setHeaderTextColor}
        onBgEnabledChange={setHeaderBgEnabled}
        onBgColorChange={setHeaderBgColor}
        onSave={saveHeader}
      />

      {/* 섹션 배경 (migration 26) */}
      <SectionBgCard
        value={bg}
        onChange={setBg}
        defaultColor="#ffffff"
        uploadPathPrefix="instagram-bg"
        isSaving={savingBg}
        showSavedFlash={bgSaved}
        onSave={saveBg}
        hint="기본값은 페이지 배경(투명)입니다."
      />

      <InstagramRssCard
        handle={handle}
        rssFeedUrl={rssFeedUrl}
        isRefreshing={isRefreshing}
        refreshMessage={refreshMessage}
        onRssFeedUrlChange={setRssFeedUrl}
        onRefresh={handleRefresh}
      />

      <InstagramPostsGrid
        handle={handle}
        posts={posts}
        uploadingSlot={uploadingSlot}
        savingSlot={savingSlot}
        onUpdatePost={(slot, patch) =>
          setPosts(prev => prev.map((p, i) => (i === slot ? { ...p, ...patch } : p)))
        }
        onSavePost={savePost}
        onDeletePost={deletePost}
        onImageFilePicked={uploadImage}
      />
    </div>
  );
}
