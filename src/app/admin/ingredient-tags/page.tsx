'use client';

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Save, ArrowUp, ArrowDown } from 'lucide-react';
import { supabase } from '@/lib/api/products';
import { TAG_CATEGORIES, type TagCategory, type IngredientTag, getAllTags } from '@/lib/api/ingredient-tags';

const LANGS: { code: string; label: string }[] = [
  { code: 'kr', label: '한국어' },
  { code: 'en', label: 'English' },
  { code: 'cn', label: '中文' },
  { code: 'jp', label: '日本語' },
  { code: 'vn', label: 'Việt' },
  { code: 'th', label: 'ไทย' },
];

type TagRow = IngredientTag & { isNew?: boolean };

const emptyRow = (category: TagCategory, sort_order: number): TagRow => ({
  id: '',
  category,
  name: { kr: '', en: '' },
  sort_order,
  is_active: true,
  isNew: true,
});

export default function IngredientTagsPage() {
  const [rows, setRows] = useState<TagRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAllTags();
    setRows(data);
    setLoading(false);
  }, []);

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { load(); }, [load]);

  function update(idx: number, patch: Partial<TagRow>) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, ...patch } : r));
  }
  function updateName(idx: number, lang: string, val: string) {
    setRows(prev => prev.map((r, i) => i === idx ? { ...r, name: { ...r.name, [lang]: val } } : r));
  }

  function addRow(cat: TagCategory) {
    const existing = rows.filter(r => r.category === cat);
    const nextSort = existing.length > 0 ? Math.max(...existing.map(r => r.sort_order)) + 10 : 10;
    setRows(prev => [...prev, emptyRow(cat, nextSort)]);
  }

  async function save(idx: number) {
    if (!supabase) { alert('Supabase 없음'); return; }
    const r = rows[idx];
    if (!r.name.kr?.trim()) { alert('최소한 한국어 이름은 입력해주세요.'); return; }
    setSaving(r.id || `new-${idx}`);
    const payload = {
      category: r.category,
      name: r.name,
      sort_order: r.sort_order,
      is_active: r.is_active,
      updated_at: new Date().toISOString(),
    };
    const res = r.isNew
      ? await supabase.from('ingredient_tags').insert(payload).select().single()
      : await supabase.from('ingredient_tags').update(payload).eq('id', r.id).select().single();
    setSaving(null);
    if (res.error) { alert(`저장 실패: ${res.error.message}`); return; }
    if (res.data) update(idx, { id: (res.data as { id: string }).id, isNew: false });
  }

  async function remove(idx: number) {
    if (!confirm('이 태그를 삭제하시겠습니까? 연결된 상품에서도 제거됩니다.')) return;
    const r = rows[idx];
    if (r.id && supabase) {
      await supabase.from('ingredient_tags').delete().eq('id', r.id);
    }
    setRows(prev => prev.filter((_, i) => i !== idx));
  }

  async function move(idx: number, dir: -1 | 1) {
    const r = rows[idx];
    const peers = rows.filter(x => x.category === r.category).sort((a, b) => a.sort_order - b.sort_order);
    const peerIdx = peers.findIndex(p => p === r);
    const target = peers[peerIdx + dir];
    if (!target) return;
    const a = r.sort_order, b = target.sort_order;
    setRows(prev => prev.map(x => {
      if (x === r) return { ...x, sort_order: b };
      if (x === target) return { ...x, sort_order: a };
      return x;
    }));
    if (supabase && r.id && target.id) {
      await Promise.all([
        supabase.from('ingredient_tags').update({ sort_order: b }).eq('id', r.id),
        supabase.from('ingredient_tags').update({ sort_order: a }).eq('id', target.id),
      ]);
    }
  }

  if (loading) return <div className="text-gray-500">로딩 중...</div>;

  return (
    <div className="max-w-5xl space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-900">
        <p className="font-semibold mb-1">💡 성분 태그</p>
        <p>3가지 분류(주요 / 기능성 / 알러지 유발) 중 하나로 태그를 만들고, 상품 편집 페이지에서 해당 상품에 여러 태그를 연결합니다. 한국어 이름은 필수이며, 다른 언어는 비어있으면 한국어로 표시됩니다.</p>
      </div>

      {TAG_CATEGORIES.map(cat => {
        const catRows = rows.map((r, i) => ({ r, i })).filter(x => x.r.category === cat.value);
        return (
          <div key={cat.value} className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-800">{cat.label_kr}</h2>
                <p className="text-xs text-gray-400">{cat.label_en}</p>
              </div>
              <button
                onClick={() => addRow(cat.value)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[#111] text-white rounded text-xs font-semibold hover:bg-black"
              >
                <Plus className="w-3.5 h-3.5" /> 태그 추가
              </button>
            </div>

            {catRows.length === 0 ? (
              <p className="text-xs text-gray-400 py-4">등록된 태그가 없습니다.</p>
            ) : (
              <div className="space-y-3">
                {catRows.map(({ r, i }) => (
                  <div key={r.id || `new-${i}`} className="border border-gray-100 rounded-lg p-3 space-y-2.5 bg-gray-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                      {LANGS.map(l => (
                        <div key={l.code}>
                          <label className="text-[9px] font-bold text-gray-500 uppercase">{l.label}</label>
                          <input
                            type="text"
                            value={r.name[l.code] ?? ''}
                            onChange={e => updateName(i, l.code, e.target.value)}
                            placeholder={l.code === 'kr' ? '예: 레티놀' : ''}
                            className="w-full mt-0.5 border border-gray-200 rounded px-2 py-1.5 text-sm outline-none focus:border-blue-400"
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 pt-1">
                      <label className="text-[9px] font-bold text-gray-500 uppercase">순서</label>
                      <input
                        type="number"
                        value={r.sort_order}
                        onChange={e => update(i, { sort_order: Number(e.target.value) || 0 })}
                        className="w-20 border border-gray-200 rounded px-2 py-1 text-sm outline-none focus:border-blue-400"
                      />
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={r.is_active} onChange={e => update(i, { is_active: e.target.checked })} className="w-3.5 h-3.5" /> 공개
                      </label>
                      <div className="ml-auto flex gap-1">
                        <button onClick={() => move(i, -1)} className="p-1.5 rounded hover:bg-gray-200" title="위로"><ArrowUp className="w-3.5 h-3.5" /></button>
                        <button onClick={() => move(i, 1)} className="p-1.5 rounded hover:bg-gray-200" title="아래로"><ArrowDown className="w-3.5 h-3.5" /></button>
                        <button
                          onClick={() => save(i)}
                          disabled={saving === (r.id || `new-${i}`)}
                          className="px-3 py-1.5 bg-[#111] text-white text-xs font-bold rounded hover:bg-black flex items-center gap-1 disabled:opacity-50"
                        >
                          <Save className="w-3.5 h-3.5" />
                          {saving === (r.id || `new-${i}`) ? '저장 중' : (r.isNew ? '추가' : '저장')}
                        </button>
                        <button onClick={() => remove(i)} className="p-1.5 rounded hover:bg-red-50 text-red-500" title="삭제"><Trash2 className="w-3.5 h-3.5" /></button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
