'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Star, Eye, EyeOff, Image as ImageIcon } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, StatStrip, PageHeader } from '@/components/admin/CafeWidgets';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import ReviewCardEditor, { type ReviewRow } from './_components/ReviewCardEditor';

// Session-aware client. Phase 2 RLS lockdown requires admin's JWT for
// review_cards writes — see migration 18.
const supabase = getSupabaseBrowser();
import { revalidateHomepageData } from '@/lib/cache/invalidate';

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

export default function ReviewsAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();
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
      toast.show('자동 채우기 중 오류가 발생했습니다.', 'error');
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

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  const stats = {
    total: rows.length,
    active: rows.filter(r => r.is_active).length,
    inactive: rows.filter(r => !r.is_active).length,
    missingImage: rows.filter(r => r.is_active && !r.image_url).length,
  };

  return (
    <div className="space-y-5 max-w-4xl">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 리뷰" value={stats.total} icon={Star} subLabel="등록된 카드" />
        <StatCard accent="#22c55e" label="게시중" value={stats.active} icon={Eye} subLabel={`전체 ${stats.total}개 중`} />
        <StatCard accent="#9ca3af" label="숨김" value={stats.inactive} icon={EyeOff} subLabel="비공개 카드" />
        <StatCard accent="#f59e0b" label="이미지 없음" value={stats.missingImage} icon={ImageIcon} subLabel="썸네일 누락" />
      </StatStrip>

      <PageHeader
        title="리뷰 카드 관리"
        description="홈 메인 · /menus/review에 표시되는 리뷰 카드를 관리합니다"
        actions={
          <button
            onClick={addRow}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 새 리뷰 카드
          </button>
        }
      />

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">💡 리뷰 쇼케이스</p>
        <p>리뷰 카드는 <strong>/menus/review + 홈 메인</strong>에 노출됩니다. 카드가 <strong>1개면</strong> 본문이 바로 인라인으로 표시되고, <strong>여러 개면</strong> 썸네일 그리드로 표시됩니다. 네이버 블로그 URL을 입력하고 &ldquo;네이버 자동 채우기&rdquo;를 누르면 제목 · 썸네일 · 본문이 자동으로 가져와집니다.</p>
      </div>

      {/* Thumbnail strip — visual index of every saved card so the
          operator can click to jump to a row without scrolling. Active
          card gets a brand-ink border + ring. */}
      {rows.length > 0 && (
        <div className="bg-white rounded border border-[#e5e7eb] p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-gray-700 uppercase tracking-wider">전체 리뷰 카드 ({rows.length})</p>
            <button
              onClick={addRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#3b82f6] text-white rounded text-xs font-semibold hover:bg-[#2563eb] transition"
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
          className="flex items-center gap-2 px-4 py-2 bg-[#3b82f6] text-white rounded-lg text-sm font-semibold hover:bg-[#2563eb] transition"
        >
          <Plus className="w-4 h-4" /> 리뷰 카드 추가
        </button>
      )}

      {rows.map((r, i) => (
        <ReviewCardEditor
          key={r.id ?? `new-${i}`}
          row={r}
          index={i}
          isFirst={i === 0}
          isLast={i === rows.length - 1}
          isFocused={focusedIdx === i}
          isSaving={saving === (r.id ?? `new-${i}`)}
          showSavedFlash={savedId !== null && savedId === r.id}
          isUploading={uploadingIdx === i}
          isNaverFetching={naverIdx === i}
          cardRef={el => { cardRefs.current[i] = el; }}
          fileRef={el => { fileRefs.current[i] = el; }}
          onUpdate={patch => update(i, patch)}
          onFile={file => handleFile(i, file)}
          onMoveUp={() => move(i, -1)}
          onMoveDown={() => move(i, 1)}
          onRemove={() => remove(i)}
          onAutoFillNaver={() => autoFillFromNaver(i)}
          onSave={() => save(i)}
        />
      ))}
    </div>
  );
}
