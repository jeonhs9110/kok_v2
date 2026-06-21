'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Tag, Layers, FolderTree } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, StatStrip, PageHeader, EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { revalidateHeaderData } from '@/lib/cache/invalidate';
import type { Category } from '@/lib/api/categories';
import CategoryRows from './_components/CategoryRows';
import CategoryModal, { type CategoryFormData } from './_components/CategoryModal';

// Session-aware client. Phase 3 RLS lockdown on `categories` requires admin JWT.
const supabase = getSupabaseBrowser();

const emptyForm: CategoryFormData = { slug: '', parent_id: '', sort_order: 0, is_active: true, name: {} };

export default function CategoriesAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CategoryFormData>({ ...emptyForm });

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
      // Header mega-menu reads the categories tree from the same memo
      // the menus admin invalidates — without this the public site shows
      // the old category list for up to 60s after a save.
      await revalidateHeaderData();
      setModalOpen(false);
      fetchAll();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '저장 실패';
      toast.show(msg, 'error');
    }
  };

  const handleDelete = async (id: string, hasChildren: boolean) => {
    const msg = hasChildren
      ? '이 카테고리와 모든 서브카테고리가 삭제됩니다. 계속하시겠습니까?'
      : '이 카테고리를 삭제하시겠습니까?';
    const ok = await confirm({ message: msg, tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    if (!supabase) return;
    await supabase.from('categories').delete().eq('id', id);
    await revalidateHeaderData();
    fetchAll();
  };

  const subCount = categories.filter(c => c.parent_id).length;
  const stats = {
    parents: parents.length,
    subs: subCount,
    total: categories.length,
  };

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 카테고리" value={stats.total} icon={Tag} subLabel="대분류 + 하위 합계" />
        <StatCard accent="#22c55e" label="대분류" value={stats.parents} icon={FolderTree} subLabel="최상위 카테고리" />
        <StatCard accent="#8b5cf6" label="하위 카테고리" value={stats.subs} icon={Layers} subLabel="서브 카테고리" />
        <StatCard accent="#f59e0b" label="평균 하위 수" value={stats.parents ? Math.round((stats.subs / stats.parents) * 10) / 10 : 0} icon={Layers} subLabel="대분류당" />
      </StatStrip>

      <PageHeader
        title="카테고리"
        description="카테고리와 서브카테고리를 관리합니다"
        actions={
          <button onClick={() => openAdd()} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] transition-colors">
            <Plus className="w-3.5 h-3.5" /> 카테고리 추가
          </button>
        }
      />

      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        {isLoading ? (
          <LoadingState />
        ) : parents.length === 0 ? (
          <EmptyState label="등록된 카테고리가 없습니다 · 위 버튼을 눌러 추가하세요" />
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[11px] uppercase tracking-wider text-[#6b7280] font-semibold">
                <th className="p-3 pl-4">순서</th>
                <th className="p-3">카테고리명</th>
                <th className="p-3">슬러그</th>
                <th className="p-3">상태</th>
                <th className="p-3 pr-4 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {parents.map(parent => (
                <CategoryRows
                  key={parent.id}
                  parent={parent}
                  subItems={getChildren(parent.id)}
                  onEdit={openEdit}
                  onDelete={handleDelete}
                  onAddChild={() => openAdd(parent.id)}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>

      <CategoryModal
        open={modalOpen}
        editingId={editingId}
        form={form}
        parents={parents}
        onFormChange={setForm}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
