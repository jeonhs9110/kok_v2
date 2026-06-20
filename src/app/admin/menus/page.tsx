'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, MessageSquare, MenuSquare, Layers } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, StatStrip, PageHeader, EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { revalidateHeaderData } from '@/lib/cache/invalidate';
import type { Menu } from '@/lib/api/menus';
import type { Lang } from '@/lib/i18n/types';
import MenuRows from './_components/MenuRows';
import MenuModal, { type MenuFormData } from './_components/MenuModal';

// Session-aware client. Phase 3 RLS lockdown on `menus` requires admin JWT.
const supabase = getSupabaseBrowser();

const emptyForm: MenuFormData = {
  slug: '', parent_id: '', page_type: 'page', board_write_role: 'admin',
  show_in_nav: true, sort_order: 0, is_published: true, title: {}, content: {},
};

const PROTECTED_SLUGS = ['support'];

export default function MenusAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MenuFormData>({ ...emptyForm });
  const [activeLang, setActiveLang] = useState<Lang>('kr');

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!supabase) return;
      const { data, error } = await supabase
        .from('menus')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: true });
      if (error) throw error;
      setMenus(data ?? []);
    } catch {
      setMenus([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const parents = menus.filter(m => !m.parent_id);
  const getChildren = (pid: string) => menus.filter(m => m.parent_id === pid);

  const openAdd = (parentId?: string) => {
    setEditingId(null);
    setForm({ ...emptyForm, parent_id: parentId || '' });
    setActiveLang('kr');
    setModalOpen(true);
  };

  const openEdit = (m: Menu) => {
    setEditingId(m.id);
    setForm({
      slug: m.slug,
      parent_id: m.parent_id || '',
      page_type: m.page_type as 'page' | 'board',
      board_write_role: (m.board_write_role as 'admin' | 'user') || 'admin',
      show_in_nav: m.show_in_nav,
      sort_order: m.sort_order,
      is_published: m.is_published,
      title: { ...m.title },
      content: { ...m.content },
    });
    setActiveLang('kr');
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!supabase || !form.slug.trim() || !form.title.kr?.trim()) return;
    const payload = {
      slug: form.slug.trim(),
      parent_id: form.parent_id || null,
      page_type: form.page_type,
      board_write_role: form.board_write_role,
      show_in_nav: form.show_in_nav,
      sort_order: form.sort_order,
      is_published: form.is_published,
      title: form.title,
      content: form.page_type === 'page' ? form.content : {},
    };
    try {
      if (editingId) {
        const { error } = await supabase.from('menus').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('menus').insert(payload);
        if (error) throw error;
      }
      // Evict the process-local header memo so the next page load picks
      // up the renamed / reordered / newly-published menu in the nav and
      // (for page_type:page rows like Brand Story) shows the fresh content
      // body without waiting on the 60s TTL.
      await revalidateHeaderData();
      setModalOpen(false);
      fetchAll();
    } catch (err: unknown) {
      toast.show(err instanceof Error ? err.message : '저장 실패', 'error');
    }
  };

  const handleDelete = async (id: string, hasChildren: boolean) => {
    const target = menus.find(m => m.id === id);
    if (target && PROTECTED_SLUGS.includes(target.slug)) {
      toast.show('이 메뉴는 시스템 메뉴이므로 삭제할 수 없습니다.', 'warning');
      return;
    }
    const msg = hasChildren ? '이 메뉴와 모든 서브메뉴가 삭제됩니다. 계속하시겠습니까?' : '이 메뉴를 삭제하시겠습니까?';
    const ok = await confirm({ message: msg, tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    if (!supabase) return;
    await supabase.from('menus').delete().eq('id', id);
    await revalidateHeaderData();
    fetchAll();
  };

  const subCount = menus.filter(m => m.parent_id).length;
  const stats = {
    total: menus.length,
    parents: parents.length,
    subs: subCount,
    boards: menus.filter(m => m.page_type === 'board').length,
  };

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 메뉴" value={stats.total} icon={MenuSquare} subLabel="대분류 + 하위 합계" />
        <StatCard accent="#22c55e" label="대분류" value={stats.parents} icon={MenuSquare} subLabel="헤더 직속" />
        <StatCard accent="#8b5cf6" label="하위 메뉴" value={stats.subs} icon={Layers} subLabel="드롭다운 항목" />
        <StatCard accent="#f59e0b" label="게시판형" value={stats.boards} icon={MessageSquare} subLabel="board 페이지 타입" />
      </StatStrip>

      <PageHeader
        title="메뉴 관리"
        description="헤더 내비게이션 메뉴를 관리합니다 · 페이지 또는 게시판 형태"
        actions={
          <button onClick={() => openAdd()} className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] transition-colors">
            <Plus className="w-3.5 h-3.5" /> 메뉴 추가
          </button>
        }
      />

      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        {isLoading ? (
          <LoadingState />
        ) : parents.length === 0 ? (
          <EmptyState label="등록된 메뉴가 없습니다 · 위 버튼을 눌러 추가하세요" />
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[11px] uppercase tracking-wider text-[#6b7280] font-semibold">
                <th className="p-3 pl-4">순서</th>
                <th className="p-3">메뉴명</th>
                <th className="p-3">슬러그</th>
                <th className="p-3">타입</th>
                <th className="p-3">상태</th>
                <th className="p-3 pr-4 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {parents.map(parent => (
                <MenuRows
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

      <MenuModal
        open={modalOpen}
        editingId={editingId}
        form={form}
        parents={parents}
        activeLang={activeLang}
        onActiveLangChange={setActiveLang}
        onFormChange={setForm}
        onClose={() => setModalOpen(false)}
        onSave={handleSave}
      />
    </div>
  );
}
