import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import { USE_RDS_FROM_BROWSER } from '@/lib/admin/rdsFlag';
import { uploadFileToS3, USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';
import type { SectionBgValue } from '@/components/admin/SectionBackgroundPanel';
import type { IgPost } from './InstagramPostsGrid';

const supabase = getSupabaseBrowser();
const BUCKET = 'product-images';
const SLOTS = 6;

const EMPTY_BG: SectionBgValue = { type: null, color: null, mediaUrl: null, mediaType: null };
const emptyPost = (i: number): IgPost => ({
  id: null, image_url: '', link_url: '', post_url: '', sort_order: i,
});

// Same regex as the embed iframe in PostsGrid.
function extractPostId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

/**
 * Single hook bundling /admin/instagram's three persistence channels:
 * config (handle + description + rss), header style (migration 34), and
 * section background (migration 26). Plus the SLOTS-bounded post grid
 * with upload + save + delete + RSS-refresh handlers.
 *
 * All three save targets piggyback on the instagram_config singleton
 * (id:1 convention) so the operator only edits one row server-side.
 */
export function useInstagram() {
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
  // Section background (migration 26).
  const [bg, setBg] = useState<SectionBgValue>(EMPTY_BG);
  const [savingBg, setSavingBg] = useState(false);
  const [bgSaved, setBgSaved] = useState(false);
  // Migration 34 — admin-editable @handle line style.
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
      let config: Record<string, unknown> | null = null;
      let fetched: Record<string, unknown>[] = [];
      if (USE_RDS_FROM_BROWSER) {
        const [cRes, pRes] = await Promise.all([
          fetch('/api/admin/instagram-config', { cache: 'no-store' }),
          fetch('/api/admin/instagram-posts', { cache: 'no-store' }),
        ]);
        if (cRes.ok) {
          const body = await cRes.json() as { row: Record<string, unknown> | null };
          config = body.row;
        }
        if (pRes.ok) {
          const body = await pRes.json() as { rows: Record<string, unknown>[] };
          fetched = body.rows ?? [];
        }
      } else {
        if (!supabase) throw new Error('no client');
        const [configRes, postsRes] = await Promise.all([
          supabase.from('instagram_config').select('*').single(),
          supabase.from('instagram_posts').select('*').order('sort_order').limit(SLOTS),
        ]);
        config = (configRes.data as Record<string, unknown> | null) ?? null;
        fetched = (postsRes.data as Record<string, unknown>[] | null) ?? [];
      }
      if (config) {
        setHandle((config.handle as string | null) ?? '');
        setDescription((config.description as string | null) ?? '');
        setRssFeedUrl((config.rss_feed_url as string | null) ?? '');
        setBg({
          type: (config.bg_type as 'color' | 'image' | 'video' | null) ?? null,
          color: (config.bg_color as string | null) ?? null,
          mediaUrl: (config.bg_media_url as string | null) ?? null,
          mediaType: (config.bg_media_type as 'image' | 'video' | null) ?? null,
        });
        setHeaderFontSize(String(parseInt((config.header_font_size as string | null) ?? '18', 10) || 18));
        setHeaderTextColor((config.header_text_color as string | null) ?? '#262626');
        setHeaderBgEnabled(!!config.header_bg_color);
        setHeaderBgColor((config.header_bg_color as string | null) ?? '#ffffff');
      }
      const filled = Array.from({ length: SLOTS }, (_, i) => fetched[i] ? {
        id: fetched[i].id as string,
        image_url: fetched[i].image_url as string,
        link_url: (fetched[i].link_url as string | null) ?? '',
        post_url: (fetched[i].post_url as string | null) ?? '',
        sort_order: i,
      } : emptyPost(i));
      setPosts(filled);
    } catch { /* use defaults */ }
    finally { setIsLoading(false); }
  }

  async function putInstagramConfig(payload: Record<string, unknown>): Promise<void> {
    if (USE_RDS_FROM_BROWSER) {
      const res = await fetch('/api/admin/instagram-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error(`API ${res.status}`);
    } else {
      if (!supabase) throw new Error('no client');
      const supabasePayload = { id: 1, ...payload, updated_at: new Date().toISOString() };
      const { error } = await supabase.from('instagram_config').upsert(supabasePayload);
      if (error) throw error;
    }
  }

  const saveConfig = async () => {
    setIsSavingConfig(true);
    try {
      await putInstagramConfig({ handle, description, rss_feed_url: rssFeedUrl });
      await revalidateHomepageData('instagram');
      toast.show('인스타그램 설정이 저장되었습니다', 'success');
    } catch { toast.show('저장에 실패했습니다.', 'error'); }
    finally { setIsSavingConfig(false); }
  };

  async function saveHeader() {
    setSavingHeader(true);
    try {
      const size = Math.max(10, Math.min(48, parseInt(headerFontSize, 10) || 18));
      await putInstagramConfig({
        header_font_size: `${size}px`,
        header_text_color: headerTextColor || null,
        header_bg_color: headerBgEnabled ? headerBgColor : null,
      });
      await revalidateHomepageData('instagram');
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
    setSavingBg(true);
    try {
      await putInstagramConfig({
        bg_type: bg.type,
        bg_color: bg.color,
        bg_media_url: bg.mediaUrl,
        bg_media_type: bg.mediaType,
      });
      await revalidateHomepageData('instagram');
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
    setUploadingSlot(slot);
    try {
      let publicUrl: string;
      if (USE_S3_FROM_BROWSER) {
        const r = await uploadFileToS3(file, { keyPrefix: 'instagram', contentType: file.type });
        publicUrl = r.publicUrl;
      } else {
        if (!supabase) return;
        const ext = file.name.split('.').pop() ?? 'jpg';
        const fileName = `instagram/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error } = await supabase.storage.from(BUCKET).upload(fileName, file, { cacheControl: '3600', upsert: false, contentType: file.type });
        if (error) throw error;
        publicUrl = supabase.storage.from(BUCKET).getPublicUrl(fileName).data.publicUrl;
      }
      setPosts(prev => prev.map((p, i) => i === slot ? { ...p, image_url: publicUrl } : p));
    } catch { toast.show('이미지 업로드에 실패했습니다.', 'error'); }
    finally { setUploadingSlot(null); }
  };

  const savePost = async (slot: number) => {
    const post = posts[slot];
    // Must have either image or post URL.
    if (!post.image_url && !post.post_url) return;
    // Validate post URL if provided.
    if (post.post_url && !extractPostId(post.post_url)) {
      toast.show('유효한 Instagram 포스트 URL이 아닙니다. 예: https://www.instagram.com/p/ABC123/', 'warning');
      return;
    }
    setSavingSlot(slot);
    try {
      const payload = { image_url: post.image_url, link_url: post.link_url, post_url: post.post_url, sort_order: slot, is_active: true };
      if (USE_RDS_FROM_BROWSER) {
        const url = post.id
          ? `/api/admin/instagram-posts?id=${encodeURIComponent(post.id)}`
          : '/api/admin/instagram-posts';
        const res = await fetch(url, {
          method: post.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        if (!post.id) {
          const { row } = await res.json() as { row: { id: string } | null };
          if (row?.id) setPosts(prev => prev.map((p, i) => i === slot ? { ...p, id: row.id } : p));
        }
      } else {
        if (!supabase) return;
        if (post.id) {
          const { error } = await supabase.from('instagram_posts').update(payload).eq('id', post.id);
          if (error) throw error;
        } else {
          const { data, error } = await supabase.from('instagram_posts').insert([payload]).select().single();
          if (error) throw error;
          setPosts(prev => prev.map((p, i) => i === slot ? { ...p, id: data.id } : p));
        }
      }
      await revalidateHomepageData('instagram');
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
    if (post.id) {
      try {
        if (USE_RDS_FROM_BROWSER) {
          // res.ok check — without this a 500 from /api/admin/instagram-posts
          // still flowed through to the optimistic clear below, leaving the
          // DB row intact while the operator saw the slot empty. Next
          // refresh would re-show the post.
          const res = await fetch(`/api/admin/instagram-posts?id=${encodeURIComponent(post.id)}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(`http_${res.status}`);
        } else if (supabase) {
          const { error } = await supabase.from('instagram_posts').delete().eq('id', post.id);
          if (error) throw error;
        }
        await revalidateHomepageData('instagram');
      } catch (err) {
        console.error('[admin/instagram] post delete failed:', err);
        toast.show('포스트 삭제에 실패했습니다.', 'error');
        return;
      }
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

  return {
    handle, setHandle,
    description, setDescription,
    rssFeedUrl, setRssFeedUrl,
    posts, setPosts,
    isRefreshing, refreshMessage,
    isLoading, isSavingConfig,
    uploadingSlot, savingSlot,
    bg, setBg, savingBg, bgSaved,
    headerFontSize, setHeaderFontSize,
    headerTextColor, setHeaderTextColor,
    headerBgEnabled, setHeaderBgEnabled,
    headerBgColor, setHeaderBgColor,
    savingHeader, headerSaved,
    saveConfig, saveHeader, saveBg,
    uploadImage, savePost, deletePost, handleRefresh,
  };
}
