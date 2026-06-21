import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
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
    if (!supabase) { setRows([]); setLoading(false); return; }
    const { data } = await supabase.from('review_cards').select('*').order('sort_order');
    setRows((data ?? []).map((r: Record<string, unknown>) => ({
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
    if (!supabase) { toast.show('Supabase가 없습니다.', 'error'); return; }
    const r = rows[i];
    setSaving(r.id ?? `new-${i}`);
    const payload = {
      image_url: r.image_url || '',
      title: r.title || '',
      content_html: r.content_html || '',
      link_url: r.link_url || null,
      sort_order: r.sort_order,
      is_active: r.is_active,
      updated_at: new Date().toISOString(),
    };
    const res = r.id
      ? await supabase.from('review_cards').update(payload).eq('id', r.id).select().single()
      : await supabase.from('review_cards').insert(payload).select().single();
    setSaving(null);
    if (res.error) { toast.show(`저장 실패: ${res.error.message}`, 'error'); return; }
    if (res.data) update(i, { id: (res.data as { id: string }).id });
    setSavedId(res.data ? (res.data as { id: string }).id : null);
    setTimeout(() => setSavedId(null), 2000);
    revalidateHomepageData('reviews');
  }

  async function remove(i: number) {
    const r = rows[i];
    const ok = await confirm({ message: '이 리뷰 카드를 삭제하시겠습니까?', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    if (r.id && supabase) {
      await supabase.from('review_cards').delete().eq('id', r.id);
      revalidateHomepageData('reviews');
    }
    setRows(prev => prev.filter((_, idx) => idx !== i));
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
    if (supabase && a.id && b.id) {
      await Promise.all([
        supabase.from('review_cards').update({ sort_order: b.sort_order }).eq('id', a.id),
        supabase.from('review_cards').update({ sort_order: a.sort_order }).eq('id', b.id),
      ]);
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
