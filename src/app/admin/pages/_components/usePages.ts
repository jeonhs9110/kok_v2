import { useCallback, useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { SUPPORTED_LANGS } from '@/lib/i18n/types';
import type { PageBlock } from '@/lib/pages/blocks';
import type { Page } from './PagesListTable';
import type { PageEditorFormData } from './PageEditorModal';

const supabase = getSupabaseBrowser();

type LangMap = Record<string, string>;
type BlocksMap = Record<string, PageBlock[]>;

const emptyLangMap = (): LangMap => ({ kr: '', en: '', cn: '', jp: '', vn: '', th: '' });
const emptyBlocksMap = (): BlocksMap => ({ kr: [], en: [], cn: [], jp: [], vn: [], th: [] });

const EMPTY_FORM: PageEditorFormData = {
  titles: emptyLangMap(),
  slug: '',
  contents: emptyLangMap(),
  blocks: emptyBlocksMap(),
  is_published: false,
  show_in_nav: false,
  nav_order: 0,
};

/**
 * State + handlers for /admin/pages. Owns the pages list, modal lifecycle
 * (editingId + activeLang + editorMode + formData), and the
 * clean-empty-lang save logic that keeps the JSONB columns tight.
 *
 * Editor mode auto-picks blocks for rows that already have any block in
 * any language; otherwise falls back to rich-text so admins editing
 * legacy pages don't see a blank page-builder.
 */
export function usePages() {
  const toast = useToast();
  const confirm = useConfirm();
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeLang, setActiveLang] = useState<string>('kr');
  const [editorMode, setEditorMode] = useState<'blocks' | 'rich'>('blocks');
  const [formData, setFormData] = useState<PageEditorFormData>(EMPTY_FORM);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('No client');
      const { data, error } = await supabase
        .from('pages')
        .select('*')
        .order('nav_order', { ascending: true });
      if (error) throw error;
      setPages((data ?? []).map(d => ({
        ...d,
        title: typeof d.title === 'string' ? { kr: d.title } : (d.title || { kr: '' }),
        content: typeof d.content === 'string' ? { kr: d.content } : (d.content || { kr: '' }),
        blocks: (d.blocks && typeof d.blocks === 'object') ? (d.blocks as BlocksMap) : null,
      })));
    } catch {
      console.warn('페이지 목록 로딩 실패');
      setPages([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setActiveLang('kr');
    setEditorMode('blocks');
    setFormData(EMPTY_FORM);
    setIsSubmitting(false);
  };

  const openCreate = () => {
    setIsModalOpen(true);
  };

  const openEdit = (page: Page) => {
    setEditingId(page.id);
    setActiveLang('kr');
    // Prefer blocks editor if any block in any language is non-empty.
    const hasBlocks = page.blocks && Object.values(page.blocks).some(arr => Array.isArray(arr) && arr.length > 0);
    setEditorMode(hasBlocks ? 'blocks' : 'rich');
    setFormData({
      titles: { ...emptyLangMap(), ...page.title },
      slug: page.slug,
      contents: { ...emptyLangMap(), ...page.content },
      blocks: { ...emptyBlocksMap(), ...(page.blocks || {}) },
      is_published: page.is_published,
      show_in_nav: page.show_in_nav,
      nav_order: page.nav_order,
    });
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!supabase) throw new Error('No client');

      // Clean empty-lang entries — keeps JSON small + makes the "has
      // content for lang X" badges accurate.
      const cleanTitles: LangMap = {};
      const cleanContents: LangMap = {};
      const cleanBlocks: BlocksMap = {};
      for (const l of SUPPORTED_LANGS) {
        if (formData.titles[l]) cleanTitles[l] = formData.titles[l];
        if (formData.contents[l]) cleanContents[l] = formData.contents[l];
        if (formData.blocks[l] && formData.blocks[l].length > 0) cleanBlocks[l] = formData.blocks[l];
      }

      const payload = {
        title: cleanTitles,
        slug: formData.slug,
        content: cleanContents,
        blocks: Object.keys(cleanBlocks).length > 0 ? cleanBlocks : null,
        is_published: formData.is_published,
        show_in_nav: formData.show_in_nav,
        nav_order: formData.nav_order,
        updated_at: new Date().toISOString(),
      };

      if (editingId) {
        const { error } = await supabase.from('pages').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('pages').insert([payload]);
        if (error) throw error;
      }

      await fetchAll();
      resetModal();
    } catch (err) {
      console.error('페이지 저장 실패:', err);
      toast.show('페이지 저장에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ message: '이 페이지를 삭제하시겠습니까?', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    try {
      if (!supabase) throw new Error('No client');
      await supabase.from('pages').delete().eq('id', id);
      setPages(prev => prev.filter(p => p.id !== id));
    } catch {
      console.warn('삭제 실패');
    }
  };

  const togglePublish = async (page: Page) => {
    try {
      if (!supabase) throw new Error('No client');
      await supabase.from('pages').update({ is_published: !page.is_published }).eq('id', page.id);
      setPages(prev => prev.map(p => p.id === page.id ? { ...p, is_published: !p.is_published } : p));
    } catch {
      console.warn('상태 변경 실패');
    }
  };

  return {
    pages, isLoading,
    isModalOpen, editingId,
    isSubmitting,
    activeLang, setActiveLang,
    editorMode, setEditorMode,
    formData, setFormData,
    openCreate, openEdit, resetModal,
    handleSubmit, handleDelete, togglePublish,
  };
}
