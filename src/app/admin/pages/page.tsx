'use client';

import { Plus } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { PageHeader, EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import { SUPPORTED_LANGS } from '@/lib/i18n/types';
import type { PageBlock } from '@/lib/pages/blocks';
import PagesListTable, { type Page } from './_components/PagesListTable';
import PageEditorModal, { type PageEditorFormData } from './_components/PageEditorModal';

// Session-aware client. Phase 4 RLS lockdown on `pages` requires admin JWT.
const supabase = getSupabaseBrowser();

type LangMap = Record<string, string>;
type BlocksMap = Record<string, PageBlock[]>;

const emptyLangMap = (): LangMap => ({ kr: '', en: '', cn: '', jp: '', vn: '', th: '' });
const emptyBlocksMap = (): BlocksMap => ({ kr: [], en: [], cn: [], jp: [], vn: [], th: [] });

const autoSlug = (title: string) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9가-힣\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 50);

export default function PagesAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeLang, setActiveLang] = useState<string>('kr');
  const [editorMode, setEditorMode] = useState<'blocks' | 'rich'>('blocks');
  const [formData, setFormData] = useState<PageEditorFormData>({
    titles: emptyLangMap(),
    slug: '',
    contents: emptyLangMap(),
    blocks: emptyBlocksMap(),
    is_published: false,
    show_in_nav: false,
    nav_order: 0,
  });

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
    setFormData({ titles: emptyLangMap(), slug: '', contents: emptyLangMap(), blocks: emptyBlocksMap(), is_published: false, show_in_nav: false, nav_order: 0 });
    setIsSubmitting(false);
  };

  const openEdit = (page: Page) => {
    setEditingId(page.id);
    setActiveLang('kr');
    // Prefer the block editor when blocks exist on the row; legacy
    // rich-text-only pages default to the rich-text tab so admins
    // don't see a blank page-builder until they migrate.
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="페이지 관리"
        description="메뉴에 표시할 페이지를 추가하고 관리하세요 (다국어 지원)"
        actions={
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> 새 페이지
          </button>
        }
      />

      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        <div className="overflow-x-auto min-h-[300px]">
          {isLoading ? (
            <LoadingState />
          ) : pages.length === 0 ? (
            <EmptyState label="등록된 페이지가 없습니다 · 새 페이지 버튼을 눌러 추가하세요" />
          ) : (
            <PagesListTable
              pages={pages}
              onEdit={openEdit}
              onDelete={handleDelete}
              onTogglePublish={togglePublish}
            />
          )}
        </div>

        {isModalOpen && (
          <PageEditorModal
            editingId={editingId}
            activeLang={activeLang}
            editorMode={editorMode}
            formData={formData}
            isSubmitting={isSubmitting}
            onClose={resetModal}
            onActiveLangChange={setActiveLang}
            onEditorModeChange={setEditorMode}
            onFormChange={setFormData}
            onSubmit={handleSubmit}
            autoSlug={autoSlug}
          />
        )}
      </div>
    </div>
  );
}
