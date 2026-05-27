'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Trash2, Save, ArrowUp, ArrowDown, Loader2 } from 'lucide-react';
import { supabase } from '@/lib/api/products';
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
  const fileRefs = useRef<Record<number, HTMLInputElement | null>>({});

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
        <p>이미지를 클릭하면 메인 페이지에서 내용(HTML)이 팝업으로 표시됩니다. 외부 링크(link_url)를 지정하면 대신 새 창에서 링크가 열립니다.</p>
      </div>

      <button
        onClick={addRow}
        className="flex items-center gap-2 px-4 py-2 bg-[#111] text-white rounded-lg text-sm font-semibold hover:bg-black transition"
      >
        <Plus className="w-4 h-4" /> 리뷰 카드 추가
      </button>

      {rows.map((r, i) => (
        <div key={r.id ?? `new-${i}`} className="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
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
            <input
              type="text"
              value={r.link_url}
              onChange={e => update(i, { link_url: e.target.value })}
              placeholder="https://... (지정하면 클릭 시 새 창에서 링크로 이동. 비워두면 아래 내용이 팝업으로 표시됩니다)"
              className="w-full mt-1 border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-blue-400 font-mono"
            />
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
                savedId && savedId === r.id ? 'bg-green-500 text-white' : 'bg-[#111] text-white hover:bg-black'
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
