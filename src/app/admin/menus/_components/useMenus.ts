import { useCallback, useEffect, useState } from 'react';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { revalidateHeaderData } from '@/lib/cache/invalidate';
import type { Menu } from '@/lib/api/menus';
import type { Lang } from '@/lib/i18n/types';
import type { MenuFormData } from './MenuModal';

const emptyForm: MenuFormData = {
  slug: '', parent_id: '', page_type: 'page', board_write_role: 'admin',
  show_in_nav: true, sort_order: 0, is_published: true, title: {}, content: {},
};

const PROTECTED_SLUGS = ['support'];

/**
 * State + handlers for /admin/menus. Reads + writes go through
 * /api/admin/crud/menus (dispatcher-gated). Header cache is evicted on
 * write so storefront nav reflects the change without the 60s TTL.
 */
export function useMenus() {
  const toast = useToast();
  const confirm = useConfirm();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MenuFormData>({ ...emptyForm });
  const [activeLang, setActiveLang] = useState<Lang>('kr');
  // In-flight guard so a double-click on 저장 doesn't send two POSTs
  // and create duplicate menu rows visible in the site header.
  const [isSaving, setIsSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/admin/crud/menus?orderBy=sort_order&direction=ASC', { cache: 'no-store' });
      if (!res.ok) throw new Error('http_' + res.status);
      const json = (await res.json()) as { rows?: Menu[] };
      setMenus(json.rows ?? []);
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
    if (isSaving) return;
    if (!form.slug.trim() || !form.title.kr?.trim()) {
      // Silently returning here hid the cause — operator clicks 저장,
      // nothing happens, no idea why. Spell it out.
      toast.show(
        !form.slug.trim()
          ? 'slug(주소)를 입력해주세요.'
          : '한국어 제목을 입력해주세요.',
        'warning',
      );
      return;
    }
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
    setIsSaving(true);
    try {
      const res = editingId
        ? await fetch('/api/admin/crud/menus', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id: editingId, patch: payload }),
          })
        : await fetch('/api/admin/crud/menus', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error('http_' + res.status);
      await revalidateHeaderData();
      setModalOpen(false);
      fetchAll();
      toast.show(editingId ? '메뉴가 수정되었습니다.' : '메뉴가 추가되었습니다.', 'success');
    } catch (err: unknown) {
      toast.show(err instanceof Error ? err.message : '저장 실패', 'error');
    } finally {
      setIsSaving(false);
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
    const res = await fetch(`/api/admin/crud/menus?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    await revalidateHeaderData();
    fetchAll();
    toast.show(res.ok ? '메뉴가 삭제되었습니다.' : '메뉴 삭제에 실패했습니다.', res.ok ? 'success' : 'error');
  };

  return {
    menus, parents, getChildren,
    isLoading,
    modalOpen, editingId,
    form, setForm,
    activeLang, setActiveLang,
    isSaving,
    openAdd, openEdit,
    closeModal: () => setModalOpen(false),
    handleSave, handleDelete,
  };
}
