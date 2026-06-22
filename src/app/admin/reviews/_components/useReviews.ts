import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { USE_RDS_FROM_BROWSER } from '@/lib/admin/rdsFlag';
import type { ReviewRow } from './ReviewCardEditor';

const supabase = getSupabaseBrowser();
const BUCKET = 'product-images';

const EMPTY: ReviewRow = {
  id: null, image_url: '', title: '', content_html: '', link_url: '',
  sort_order: 0, is_active: true,
};

async function uploadImage(file: File): Promise<string> {
  if (!supabase) throw new Error('No Supabase');
  const ext = file.name.split('.').pop() ?? 'jpg';
  const path = `reviews/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: false });
  if (error) throw error;
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * State + handlers for /admin/reviews. Owns the rows list, save/upload
 * progress markers, naver auto-fill state, file + card refs (for the
 * thumbnail-strip scroll-into-view), and every DB mutation.
 *
 * Naver auto-fill never overwrites a row's filled fields — admins prefill
 * what they want kept, then hit the button for the rest.
 */
export function useReviews() {
  const toast = useToast();
  const confirm = useConfirm();
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  // Naver auto-fill UX state, keyed by row index.
  const [naverIdx, setNaverIdx] = useState<number | null>(null);
  // Currently-highlighted card driven by the thumbnail-strip click.
  const [focusedIdx, setFocusedIdx] = useState<number | null>(null);
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});
  const cardRefs = useRef<Record<number, HTMLDivElement | null>>({});

  const load = useCallback(async () => {
    setLoading(true);
    let raw: Record<string, unknown>[] = [];
    if (USE_RDS_FROM_BROWSER) {
      const res = await fetch('/api/admin/review-cards', { cache: 'no-store' });
      if (res.ok) {
        const { rows } = await res.json() as { rows: Record<string, unknown>[] };
        raw = rows ?? [];
      }
    } else if (supabase) {
      const { data } = await supabase.from('review_cards').select('*').order('sort_order');
      raw = data ?? [];
    }
    setRows(raw.map(r => ({
      id: r.id as string,
      image_url: (r.image_url as string) ?? '',
      title: (r.title as string) ?? '',
      content_html: (r.content_html as string) ?? '',
      link_url: (r.link_url as string) ?? '',
      sort_order: (r.sort_order as number) ?? 0,
      is_active: r.is_active !== false,
    })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function update(i: number, patch: Partial<ReviewRow>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function addRow() {
    const nextSort = rows.length > 0 ? Math.max(...rows.map(r => r.sort_order)) + 10 : 10;
    setRows(prev => [...prev, { ...EMPTY, sort_order: nextSort }]);
  }

  async function autoFillFromNaver(i: number) {
    const row = rows[i];
    if (!row?.link_url) {
      toast.show('먼저 외부 링크 칸에 네이버 블로그 / 포스트 URL을 입력해주세요.', 'warning');
      return;
    }
    setNaverIdx(i);
    try {
      const res = await fetch('/api/reviews/scrape-naver', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: row.link_url }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        toast.show(err.error === 'unsupported_host'
          ? '네이버 블로그/포스트 URL만 자동 채우기를 지원합니다.'
          : '자동 채우기에 실패했습니다.', 'error');
        return;
      }
      const data: {
        title: string | null;
        image_url: string | null;
        description: string | null;
        body_html: string | null;
      } = await res.json();
      // Preferred content: parsed Naver post body. Fallback to og:description.
      const newContent =
        data.body_html ||
        (data.description ? `<p>${data.description}</p>` : '');
      update(i, {
        title: row.title || data.title || '',
        image_url: row.image_url || data.image_url || '',
        // Body wins over existing content_html when the scraper returns
        // non-empty body — admins hit 자동 채우기 to refresh the body.
        content_html: newContent || row.content_html,
      });
    } catch (err) {
      console.error('[admin/reviews] naver scrape failed:', err);
      toast.show('자동 채우기 중 오류가 발생했습니다.', 'error');
    } finally {
      setNaverIdx(null);
    }
  }

  async function save(i: number) {
    const r = rows[i];
    setSaving(r.id ?? `new-${i}`);
    const payload = {
      image_url: r.image_url || '',
      title: r.title || '',
      content_html: r.content_html || '',
      link_url: r.link_url || null,
      sort_order: r.sort_order,
      is_active: r.is_active,
    };
    try {
      let returnedId: string | null = null;
      if (USE_RDS_FROM_BROWSER) {
        const url = r.id
          ? `/api/admin/review-cards?id=${encodeURIComponent(r.id)}`
          : '/api/admin/review-cards';
        const res = await fetch(url, {
          method: r.id ? 'PATCH' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error(`API ${res.status}`);
        if (!r.id) {
          const { row } = await res.json() as { row: { id: string } | null };
          returnedId = row?.id ?? null;
        } else {
          returnedId = r.id;
        }
      } else {
        if (!supabase) { toast.show('Supabase가 없습니다.', 'error'); setSaving(null); return; }
        const supaPayload = { ...payload, updated_at: new Date().toISOString() };
        const res = r.id
          ? await supabase.from('review_cards').update(supaPayload).eq('id', r.id).select().single()
          : await supabase.from('review_cards').insert(supaPayload).select().single();
        if (res.error) throw res.error;
        returnedId = res.data ? (res.data as { id: string }).id : null;
      }
      if (returnedId && !r.id) update(i, { id: returnedId });
      setSavedId(returnedId);
      setTimeout(() => setSavedId(null), 2000);
      revalidateHomepageData('reviews');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '저장 실패';
      toast.show(`저장 실패: ${msg}`, 'error');
    } finally {
      setSaving(null);
    }
  }

  async function remove(i: number) {
    const r = rows[i];
    const ok = await confirm({ message: '이 리뷰 카드를 삭제하시겠습니까?', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    // Optimistic remove. If the DB call fails, restore + toast so the
    // card doesn't silently vanish from the UI.
    const snapshot = rows;
    setRows(prev => prev.filter((_, idx) => idx !== i));
    if (r.id) {
      try {
        if (USE_RDS_FROM_BROWSER) {
          const res = await fetch(`/api/admin/review-cards?id=${encodeURIComponent(r.id)}`, { method: 'DELETE' });
          if (!res.ok) throw new Error(`API ${res.status}`);
        } else if (supabase) {
          const { error } = await supabase.from('review_cards').delete().eq('id', r.id);
          if (error) throw error;
        }
        revalidateHomepageData('reviews');
      } catch (err) {
        console.warn('[admin/reviews] 삭제 실패:', err);
        setRows(snapshot);
        toast.show('삭제에 실패했습니다.', 'error');
      }
    }
  }

  async function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= rows.length) return;
    const a = rows[i], b = rows[j];
    setRows(prev => {
      const next = [...prev];
      next[i] = { ...a, sort_order: b.sort_order };
      next[j] = { ...b, sort_order: a.sort_order };
      return next;
    });
    if (a.id && b.id) {
      if (USE_RDS_FROM_BROWSER) {
        await Promise.all([
          fetch(`/api/admin/review-cards?id=${encodeURIComponent(a.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order: b.sort_order }),
          }),
          fetch(`/api/admin/review-cards?id=${encodeURIComponent(b.id)}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sort_order: a.sort_order }),
          }),
        ]);
      } else if (supabase) {
        await Promise.all([
          supabase.from('review_cards').update({ sort_order: b.sort_order }).eq('id', a.id),
          supabase.from('review_cards').update({ sort_order: a.sort_order }).eq('id', b.id),
        ]);
      }
      // Tag eviction so the storefront's unstable_cache wrapper drops
      // the cached order immediately — was staling for up to 60s before.
      revalidateHomepageData('reviews');
    }
  }

  async function handleFile(i: number, file: File) {
    setUploadingIdx(i);
    try {
      const url = await uploadImage(file);
      update(i, { image_url: url });
    } catch {
      toast.show('이미지 업로드 실패', 'error');
    } finally {
      setUploadingIdx(null);
      if (fileRefs.current[i]) fileRefs.current[i]!.value = '';
    }
  }

  return {
    rows,
    loading,
    saving,
    savedId,
    uploadingIdx,
    naverIdx,
    focusedIdx,
    fileRefs,
    cardRefs,
    setFocusedIdx,
    update,
    addRow,
    autoFillFromNaver,
    save,
    remove,
    move,
    handleFile,
  };
}
