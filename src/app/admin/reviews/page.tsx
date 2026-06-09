'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Save, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// Session-aware client. Phase 2 RLS lockdown requires admin's JWT for
// review_cards writes — see migration 18.
const supabase = getSupabaseBrowser();
import RichEditor from '@/components/admin/RichEditor';
import { revalidateHomepageData } from '@/lib/cache/invalidate';

const BUCKET = 'product-images';

interface ReviewRow {
  id: string | null;
  image_url: string;
  title: string;
  content_html: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
}

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

export default function ReviewsAdminPage() {
  const [rows, setRows] = useState<ReviewRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);
  // Naver auto-fill UX state. Keyed by row index so two cards being
  // edited in parallel don't clobber each other's loading spinner.
  const [naverIdx, setNaverIdx] = useState<number | null>(null);
  // Index of the currently-highlighted card; driven by the thumbnail
  // strip click handler so the matching card below gets a brand-ink
  // border and the strip cell shows the selected ring.
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

  // Calls /api/reviews/scrape-naver with the row's link_url and patches
  // any returned og:* fields into the row's title / image_url /
  // content_html. Existing non-empty fields are NOT overwritten — admin
  // can pre-fill anything they want kept.
  async function autoFillFromNaver(i: number) {
    const row = rows[i];
    if (!row?.link_url) {
      alert('먼저 외부 링크 칸에 네이버 블로그 / 포스트 URL을 입력해주세요.');
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
        alert(err.error === 'unsupported_host'
          ? '네이버 블로그/포스트 URL만 자동 채우기를 지원합니다.'
          : '자동 채우기에 실패했습니다.');
        return;
      }
      const data: {
        title: string | null;
        image_url: string | null;
        description: string | null;
        body_html: string | null;
      } = await res.json();
      // Preferred content: the actual Naver post body parsed out of the
      // se-main-container / postViewArea. Falls back to og:description
      // for older posts where the extractor can't find the body block.
      const newContent =
        data.body_html ||
        (data.description ? `<p>${data.description}</p>` : '');
      update(i, {
        title: row.title || data.title || '',
        image_url: row.image_url || data.image_url || '',
        // Body content always wins over existing content_html when the
        // scraper returns a non-empty body — admins typically hit 자동
        // 채우기 specifically to refresh the body, not the title.
        content_html: newContent || row.content_html,
      });
    } catch (err) {
      console.error('[admin/reviews] naver scrape failed:', err);
      alert('자동 채우기 중 오류가 발생했습니다.');
    } finally {
      setNaverIdx(null);
    }
  }

  function update(i: number, patch: Partial<ReviewRow>) {
    setRows(prev => prev.map((r, idx) => idx === i ? { ...r, ...patch } : r));
  }

  function addRow() {
    const nextSort = rows.length > 0 ? Math.max(...rows.map(r => r.sort_order)) + 10 : 10;
    setRows(prev => [...prev, { ...EMPTY, sort_order: nextSort }]);
  }

  async function save(i: number) {
    if (!supabase) { alert('Supabase가 없습니다.'); return; }
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
    if (res.error) { alert(`저장 실패: ${res.error.message}`); return; }
    if (res.data) update(i, { id: (res.data as { id: string }).id });
    setSavedId(res.data ? (res.data as { id: string }).id : null);
    setTimeout(() => setSavedId(null), 2000);
    revalidateHomepageData('reviews');
  }

  async function remove(i: number) {
    const r = rows[i];
    if (!confirm('이 리뷰 카드를 삭제하시겠습니까?')) return;
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
      alert('이미지 업로드 실패');
    } finally {
      setUploadingIdx(null);
      if (fileRefs.current[i]) fileRefs.current[i]!.value = '';
    }
  }

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  return (
    <div className="space-y-4 max-w-4xl">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">💡 리뷰 쇼케이스</p>
        <p>리뷰 카드는 <strong>/menus/review</strong> 페이지에 노출됩니다. 카드가 <strong>1개면</strong> 본문이 바로 인라인으로 표시되고, <strong>여러 개면</strong> 썸네일 그리드로 표시됩니다. 네이버 블로그 URL을 입력하고 &ldquo;네이버 자동 채우기&rdquo;를 누르면 제목 · 썸네일 · 본문이 자동으로 가져와집니다.</p>
      </div>

      {/* Thumbnail strip — quick visual index of every saved card so the
          admin can click to jump to a specific row without scrolling.
          Active card gets a brand-ink border + ring; hover shows the
          card's sort order on top. 송이's request: see everything at a
          glance, then pick which one to edit. */}
      {rows.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">전체 리뷰 카드 ({rows.length})</p>
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-brand-ink text-white rounded text-xs font-semibold hover:bg-black transition"
            >
              <Plus className="w-3.5 h-3.5" /> 새 리뷰 카드
            </button>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
            {rows.map((r, i) => {
              const active = focusedIdx === i;
              return (
                <button
                  key={r.id ?? `thumb-${i}`}
                  type="button"
                  onClick={() => {
                    setFocusedIdx(i);
                    // Smooth-scroll the matching card into view so the admin
                    // can edit it without manual scrolling on long lists.
                    cardRefs.current[i]?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }}
                  className={`group relative aspect-square overflow-hidden rounded border-2 transition-all ${
                    active ? 'border-brand-ink ring-2 ring-brand-ink/20' : 'border-gray-200 hover:border-gray-400'
                  } ${!r.is_active ? 'opacity-50' : ''}`}
                  title={r.title || '(제목 없음)'}
                >
                  {r.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={r.image_url} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[9px] font-bold text-gray-400">
                      NO IMG
                    </div>
                  )}
                  {/* Sort-order badge — visible on hover only so the thumbnails read clean by default. */}
                  <span className="absolute top-1 left-1 bg-black/70 text-white text-[9px] font-mono px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    {r.sort_order}
                  </span>
                  {!r.is_active && (
                    <span className="absolute bottom-1 right-1 bg-red-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                      비공개
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {rows.length === 0 && (
        <button
          onClick={addRow}
          className="flex items-center gap-2 px-4 py-2 bg-brand-ink text-white rounded-lg text-sm font-semibold hover:bg-black transition"
        >
          <Plus className="w-4 h-4" /> 리뷰 카드 추가
        </button>
      )}

      {rows.map((r, i) => (
        <div
          key={r.id ?? `new-${i}`}
          ref={el => { cardRefs.current[i] = el; }}
          className={`bg-white rounded-xl border p-5 space-y-4 transition-shadow ${
            focusedIdx === i ? 'border-brand-ink shadow-md' : 'border-gray-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold">{r.title || '(제목 없음)'}</p>
            <div className="flex gap-1">
              <button onClick={() => move(i, -1)} disabled={i === 0} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30" title="위로"><ArrowUp className="w-4 h-4" /></button>
              <button onClick={() => move(i, 1)} disabled={i === rows.length - 1} className="p-1.5 rounded hover:bg-gray-100 disabled:opacity-30" title="아래로"><ArrowDown className="w-4 h-4" /></button>
              <button onClick={() => remove(i)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="삭제"><Trash2 className="w-4 h-4" /></button>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">썸네일 이미지</label>
            <div className="flex gap-3 mt-1 items-start">
              {r.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image_url} alt="" className="w-24 h-24 object-cover rounded border border-gray-200" />
              ) : (
                <div className="w-24 h-24 bg-gray-100 rounded border border-gray-200 flex items-center justify-center text-[10px] text-gray-400">NO IMG</div>
              )}
              <div className="flex-1 space-y-2">
                <input
                  ref={el => { fileRefs.current[i] = el; }}
                  type="file"
                  accept="image/*"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(i, f); }}
                  className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-gray-100 file:text-gray-700 hover:file:bg-gray-200"
                />
                {uploadingIdx === i && <p className="text-[11px] text-blue-500 flex items-center gap-1.5"><Loader2 className="w-3 h-3 animate-spin" /> 업로드 중...</p>}
              </div>
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">제목</label>
            <input
              type="text"
              value={r.title}
              onChange={e => update(i, { title: e.target.value })}
              placeholder="리뷰 제목 (옵션, 썸네일 위에 표시)"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">외부 링크 (선택)</label>
            <div className="flex gap-2 mt-1">
              <input
                type="text"
                value={r.link_url}
                onChange={e => update(i, { link_url: e.target.value })}
                placeholder="https://... (지정하면 클릭 시 새 창에서 링크로 이동. 비워두면 아래 내용이 팝업으로 표시됩니다)"
                className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono"
              />
              <button
                type="button"
                onClick={() => autoFillFromNaver(i)}
                disabled={naverIdx === i || !r.link_url}
                title="네이버 블로그/포스트 URL이면 제목·이미지·설명을 자동으로 채워요"
                className="px-3 py-2 text-xs font-bold text-white bg-[#03c75a] hover:bg-[#02b14d] disabled:opacity-40 rounded-lg whitespace-nowrap flex items-center gap-1.5"
              >
                {naverIdx === i ? <><Loader2 className="w-3 h-3 animate-spin" />가져오는 중...</> : '네이버 자동 채우기'}
              </button>
            </div>
            <p className="text-[10px] text-gray-400 mt-1">
              네이버 블로그 / 포스트 / 네이버 단축 URL(naver.me)을 인식합니다. 이미 채워진 칸은 덮어쓰지 않아요.
            </p>
          </div>

          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase">리뷰 내용 (HTML, 팝업에 표시)</label>
            <div className="mt-1">
              <RichEditor
                content={r.content_html}
                onChange={html => update(i, { content_html: html })}
                uploadPath="reviews-body"
                minHeight={200}
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div>
              <label className="text-[10px] font-bold text-gray-500 uppercase">정렬</label>
              <input
                type="number"
                value={r.sort_order}
                onChange={e => update(i, { sort_order: Number(e.target.value) || 0 })}
                className="w-24 mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <label className="flex items-center gap-2 text-sm mt-5 cursor-pointer">
              <input
                type="checkbox"
                checked={r.is_active}
                onChange={e => update(i, { is_active: e.target.checked })}
                className="w-4 h-4 rounded"
              />
              공개
            </label>
          </div>

          <div className="flex items-center gap-3 pt-3 border-t border-gray-100">
            <button
              onClick={() => save(i)}
              disabled={saving === (r.id ?? `new-${i}`)}
              className={`px-5 py-2 rounded-lg font-semibold text-sm flex items-center gap-2 transition ${
                savedId && savedId === r.id ? 'bg-green-500 text-white' : 'bg-brand-ink text-white hover:bg-black'
              } disabled:opacity-50`}
            >
              <Save className="w-4 h-4" />
              {saving === (r.id ?? `new-${i}`) ? '저장 중...' : savedId === r.id ? '✓ 저장 완료' : (r.id ? '저장' : '추가')}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
