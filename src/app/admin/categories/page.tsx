'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, X } from 'lucide-react';
import { supabase } from '@/lib/api/products';
import type { Category } from '@/lib/api/categories';
import { SUPPORTED_LANGS, LANG_LABELS } from '@/lib/i18n/types';

interface FormData {
  slug: string;
  parent_id: string;
  sort_order: number;
  is_active: boolean;
  name: Record<string, string>;
}

const emptyForm: FormData = { slug: '', parent_id: '', sort_order: 0, is_active: true, name: {} };

export default function CategoriesAdminPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      setCategories(data ?? []);
    } catch {
      setCategories([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const parents = categories.filter(c => !c.parent_id);
  const getChildren = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const openAdd = (parentId?: string) => {
    setEditingId(null);
    setForm({ ...emptyForm, parent_id: parentId || '' });
    setModalOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditingId(cat.id);
    setForm({
      slug: cat.slug,
      parent_id: cat.parent_id || '',
      sort_order: cat.sort_order,
      is_active: cat.is_active,
      name: { ...cat.name },
    });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!supabase || !form.slug.trim() || !form.name.kr?.trim()) return;
    const payload = {
      slug: form.slug.trim(),
      parent_id: form.parent_id || null,
      sort_order: form.sort_order,
      is_active: form.is_active,
      name: form.name,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from('categories').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('categories').insert(payload);
        if (error) throw error;
      }
      setModalOpen(false);
      fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '저장 실패';
      alert(msg);
    }
  };

  const handleDelete = async (id: string, hasChildren: boolean) => {
    const msg = hasChildren
      ? '이 카테고리와 모든 서브카테고리가 삭제됩니다. 계속하시겠습니까?'
      : '이 카테고리를 삭제하시겠습니까?';
    if (!confirm(msg)) return;
    if (!supabase) return;
    await supabase.from('categories').delete().eq('id', id);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <p className="text-sm text-gray-500">카테고리와 서브카테고리를 관리합니다.</p>
        <button onClick={() => openAdd()} className="flex items-center gap-2 px-4 py-2.5 bg-[#111] text-white text-sm font-semibold rounded-lg hover:bg-black transition-colors">
          <Plus className="w-4 h-4" /> 카테고리 추가
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm font-bold tracking-widest">불러오는 중...</div>
        ) : parents.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="font-semibold">등록된 카테고리가 없습니다</p>
            <p className="text-xs mt-1">위 버튼을 눌러 카테고리를 추가하세요</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="p-4 pl-6">순서</th>
                <th className="p-4">카테고리명</th>
                <th className="p-4">슬러그</th>
                <th className="p-4">상태</th>
                <th className="p-4 pr-6 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {parents.map(parent => {
                const children = getChildren(parent.id);
                return (
                  <CategoryRows
                    key={parent.id}
                    parent={parent}
                    children={children}
                    onEdit={openEdit}
                    onDelete={handleDelete}
                    onAddChild={() => openAdd(parent.id)}
                  />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setModalOpen(false)}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold">{editingId ? '카테고리 수정' : '카테고리 추가'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Parent selector */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">분류</label>
                <select
                  value={form.parent_id}
                  onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                >
                  <option value="">최상위 카테고리</option>
                  {parents.filter(p => p.id !== editingId).map(p => (
                    <option key={p.id} value={p.id}>↳ {p.name.kr || p.slug} 의 서브카테고리</option>
                  ))}
                </select>
              </div>

              {/* Slug */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">슬러그 (URL용, 영문)</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                  placeholder="예: serum, cream, pdrn"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                />
              </div>

              {/* Language names */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">카테고리명 (다국어)</label>
                <div className="grid grid-cols-2 gap-3">
                  {SUPPORTED_LANGS.map(l => (
                    <div key={l}>
                      <label className="block text-[10px] text-gray-400 mb-1">{LANG_LABELS[l]}{l === 'kr' && ' *'}</label>
                      <input
                        type="text"
                        value={form.name[l] || ''}
                        onChange={e => setForm(f => ({ ...f, name: { ...f.name, [l]: e.target.value } }))}
                        placeholder={l === 'kr' ? '필수' : '선택'}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Sort order + active */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1.5">정렬 순서</label>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.is_active}
                      onChange={e => setForm(f => ({ ...f, is_active: e.target.checked }))}
                      className="w-4 h-4 rounded"
                    />
                    <span className="text-sm text-gray-700">활성화</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm text-gray-600 hover:text-black transition-colors">취소</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-[#111] text-white text-sm font-semibold rounded-lg hover:bg-black transition-colors">
                {editingId ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryRows({
  parent, children, onEdit, onDelete, onAddChild,
}: {
  parent: Category;
  children: Category[];
  onEdit: (c: Category) => void;
  onDelete: (id: string, hasChildren: boolean) => void;
  onAddChild: () => void;
}) {
  return (
    <>
      {/* Parent row */}
      <tr className="hover:bg-gray-50/50 transition-colors">
        <td className="p-4 pl-6 text-sm text-gray-500 w-16">{parent.sort_order}</td>
        <td className="p-4">
          <span className="font-bold text-gray-900 text-sm">{parent.name.kr || parent.slug}</span>
          {parent.name.en && <span className="ml-2 text-xs text-gray-400">{parent.name.en}</span>}
        </td>
        <td className="p-4 text-sm text-gray-500 font-mono">{parent.slug}</td>
        <td className="p-4">
          <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${parent.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {parent.is_active ? '활성' : '비활성'}
          </span>
        </td>
        <td className="p-4 pr-6 text-right">
          <div className="flex gap-1 justify-end">
            <button onClick={onAddChild} title="서브카테고리 추가" className="text-gray-400 hover:text-blue-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-100 transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => onEdit(parent)} title="수정" className="text-gray-400 hover:text-amber-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-100 transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            <button onClick={() => onDelete(parent.id, children.length > 0)} title="삭제" className="text-gray-400 hover:text-red-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-100 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </td>
      </tr>
      {/* Child rows */}
      {children.map(child => (
        <tr key={child.id} className="hover:bg-gray-50/50 transition-colors bg-gray-50/30">
          <td className="p-4 pl-6 text-sm text-gray-400 w-16">{child.sort_order}</td>
          <td className="p-4 pl-10">
            <span className="flex items-center gap-1.5 text-sm text-gray-700">
              <ChevronRight className="w-3 h-3 text-gray-300" />
              {child.name.kr || child.slug}
              {child.name.en && <span className="ml-1 text-xs text-gray-400">{child.name.en}</span>}
            </span>
          </td>
          <td className="p-4 text-sm text-gray-400 font-mono">{child.slug}</td>
          <td className="p-4">
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${child.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {child.is_active ? '활성' : '비활성'}
            </span>
          </td>
          <td className="p-4 pr-6 text-right">
            <div className="flex gap-1 justify-end">
              <button onClick={() => onEdit(child)} title="수정" className="text-gray-400 hover:text-amber-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-100 transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(child.id, false)} title="삭제" className="text-gray-400 hover:text-red-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-100 transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
