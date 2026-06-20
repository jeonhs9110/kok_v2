'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, ChevronRight, X, FileText, MessageSquare, ExternalLink, MenuSquare, Layers } from 'lucide-react';
import Link from 'next/link';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, StatStrip, PageHeader, EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';
import RichEditor from '@/components/admin/RichEditor';
import { revalidateHeaderData } from '@/lib/cache/invalidate';

// Session-aware client. Phase 3 RLS lockdown on `menus` requires admin JWT.
const supabase = getSupabaseBrowser();
import type { Menu } from '@/lib/api/menus';
import { SUPPORTED_LANGS, LANG_LABELS, type Lang } from '@/lib/i18n/types';

interface FormData {
  slug: string;
  parent_id: string;
  page_type: 'page' | 'board';
  board_write_role: 'admin' | 'user';
  show_in_nav: boolean;
  sort_order: number;
  is_published: boolean;
  title: Record<string, string>;
  content: Record<string, string>;
}

const emptyForm: FormData = {
  slug: '', parent_id: '', page_type: 'page', board_write_role: 'admin',
  show_in_nav: true, sort_order: 0, is_published: true, title: {}, content: {},
};

export default function MenusAdminPage() {
  const toast = useToast();
  const confirm = useConfirm();
  const [menus, setMenus] = useState<Menu[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>({ ...emptyForm });
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
      // body without waiting on the 60s TTL. Same call site used by the
      // categories and logo admins for parity.
      await revalidateHeaderData();
      setModalOpen(false);
      fetchAll();
    } catch (err: unknown) {
      toast.show(err instanceof Error ? err.message : '저장 실패', 'error');
    }
  };

  const PROTECTED_SLUGS = ['support'];

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
              {parents.map(parent => {
                const children = getChildren(parent.id);
                return (
                  <MenuRows key={parent.id} parent={parent} subItems={children} onEdit={openEdit} onDelete={handleDelete} onAddChild={() => openAdd(parent.id)} />
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setModalOpen(false); }}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-[#e5e7eb] bg-[#fafbfc]">
              <h3 className="text-[14px] font-bold text-[#1f2937]">{editingId ? '메뉴 수정' : '메뉴 추가'}</h3>
              <button onClick={() => setModalOpen(false)} className="text-[#9ca3af] hover:text-[#1f2937] p-1 rounded hover:bg-[#f3f4f6] transition-colors"><X className="w-4 h-4" /></button>
            </div>
            <div className="p-6 space-y-5">
              {/* Parent */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">분류</label>
                  <select value={form.parent_id} onChange={e => setForm(f => ({ ...f, parent_id: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5">
                    <option value="">최상위 메뉴</option>
                    {parents.filter(p => p.id !== editingId).map(p => (
                      <option key={p.id} value={p.id}>↳ {p.title.kr || p.slug}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">슬러그 (URL)</label>
                  <input type="text" value={form.slug} onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))} placeholder="예: events, brand-story" className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                </div>
              </div>

              {/* Page type + board role */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">페이지 타입</label>
                  <select value={form.page_type} onChange={e => setForm(f => ({ ...f, page_type: e.target.value as 'page' | 'board' }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5">
                    <option value="page">단순 페이지 (글)</option>
                    <option value="board">게시판 (게시글 목록)</option>
                  </select>
                </div>
                {form.page_type === 'board' && (
                  <div>
                    <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">글쓰기 권한</label>
                    <select value={form.board_write_role} onChange={e => setForm(f => ({ ...f, board_write_role: e.target.value as 'admin' | 'user' }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5">
                      <option value="admin">관리자만</option>
                      <option value="user">소비자도 가능</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Multi-lang: tabs for title + content */}
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-2">다국어 콘텐츠</label>
                <div className="flex gap-1 mb-3">
                  {SUPPORTED_LANGS.map(l => (
                    <button key={l} type="button" onClick={() => setActiveLang(l)} className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${activeLang === l ? 'bg-black text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                      {LANG_LABELS[l]}
                      {(form.title[l] || form.content[l]) && <span className="ml-1 w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />}
                    </button>
                  ))}
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-[10px] text-gray-400 mb-1">메뉴명 ({LANG_LABELS[activeLang]}) {activeLang === 'kr' && '*'}</label>
                    <input type="text" value={form.title[activeLang] || ''} onChange={e => setForm(f => ({ ...f, title: { ...f.title, [activeLang]: e.target.value } }))} className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                  </div>

                  {form.page_type === 'page' && (
                    <div>
                      <label className="block text-[10px] text-gray-400 mb-1">콘텐츠 ({LANG_LABELS[activeLang]})</label>
                      {/* Rich editor (TipTap) replaces the raw-HTML textarea.
                          Gives the admin Bold / Italic / Underline /
                          headings / lists / link / image upload / video
                          upload / YouTube + Vimeo embeds. The rendered
                          HTML is sanitized by MenuPage before being
                          dangerouslySetInnerHTML'd into the page body. */}
                      <RichEditor
                        key={`${editingId ?? 'new'}-${activeLang}`}
                        content={form.content[activeLang] || ''}
                        onChange={(html) =>
                          setForm(f => ({ ...f, content: { ...f.content, [activeLang]: html } }))
                        }
                        uploadPath={`menus/${form.slug || 'draft'}`}
                        minHeight={320}
                      />
                    </div>
                  )}
                </div>
              </div>

              {/* Options */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-[11px] font-semibold text-[#6b7280] mb-1">정렬 순서</label>
                  <input type="number" value={form.sort_order} onChange={e => setForm(f => ({ ...f, sort_order: Number(e.target.value) }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.is_published} onChange={e => setForm(f => ({ ...f, is_published: e.target.checked }))} className="w-4 h-4 rounded" />
                    <span className="text-sm text-gray-700">게시</span>
                  </label>
                </div>
                <div className="flex items-end pb-1">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.show_in_nav} onChange={e => setForm(f => ({ ...f, show_in_nav: e.target.checked }))} className="w-4 h-4 rounded" />
                    <span className="text-sm text-gray-700">네비 표시</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-[#e5e7eb] bg-[#fafbfc] flex justify-end gap-2">
              <button onClick={() => setModalOpen(false)} className="px-4 py-2.5 text-sm text-gray-600 hover:text-black transition-colors">취소</button>
              <button onClick={handleSave} className="px-6 py-2.5 bg-[#3b82f6] text-white text-sm font-semibold rounded-lg hover:bg-[#2563eb] transition-colors">
                {editingId ? '수정' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuRows({ parent, subItems, onEdit, onDelete, onAddChild }: {
  parent: Menu; subItems: Menu[];
  onEdit: (m: Menu) => void; onDelete: (id: string, h: boolean) => void; onAddChild: () => void;
}) {
  const typeIcon = (m: Menu) => m.page_type === 'board'
    ? <MessageSquare className="w-3.5 h-3.5 text-blue-500" />
    : <FileText className="w-3.5 h-3.5 text-gray-400" />;

  const typeLabel = (m: Menu) => {
    if (m.page_type === 'board') return m.board_write_role === 'user' ? '게시판 (소비자)' : '게시판 (관리자)';
    return '페이지';
  };

  return (
    <>
      <tr className="hover:bg-[#fafbfc] transition-colors">
        <td className="p-3 pl-4 text-[12px] text-gray-500 w-16">{parent.sort_order}</td>
        <td className="p-3">
          <span className="font-bold text-gray-900 text-sm">{parent.title.kr || parent.slug}</span>
          {parent.title.en && <span className="ml-2 text-xs text-gray-400">{parent.title.en}</span>}
        </td>
        <td className="p-3 text-[12px] text-gray-500 font-mono">{parent.slug}</td>
        <td className="p-3">
          <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            {typeIcon(parent)} {typeLabel(parent)}
          </span>
        </td>
        <td className="p-3">
          <div className="flex gap-1.5">
            <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${parent.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
              {parent.is_published ? '게시' : '비공개'}
            </span>
            {parent.show_in_nav && <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-600">네비</span>}
          </div>
        </td>
        <td className="p-3 pr-4 text-right">
          <div className="flex gap-1 justify-end">
            {parent.page_type === 'board' && (
              <Link href={`/admin/menus/${parent.id}/posts`} title="게시글 관리" className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
                <ExternalLink className="w-4 h-4" />
              </Link>
            )}
            <button onClick={onAddChild} title="서브메뉴 추가" className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
              <Plus className="w-4 h-4" />
            </button>
            <button onClick={() => onEdit(parent)} title="수정" className="text-gray-400 hover:text-amber-600 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
              <Pencil className="w-4 h-4" />
            </button>
            {parent.slug !== 'support' && (
              <button onClick={() => onDelete(parent.id, subItems.length > 0)} title="삭제" className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        </td>
      </tr>
      {subItems.map(child => (
        <tr key={child.id} className="hover:bg-[#fafbfc] transition-colors bg-gray-50/30">
          <td className="p-3 pl-4 text-[12px] text-gray-400 w-16">{child.sort_order}</td>
          <td className="p-3 pl-10">
            <span className="flex items-center gap-1.5 text-sm text-gray-700">
              <ChevronRight className="w-3 h-3 text-gray-300" />
              {child.title.kr || child.slug}
              {child.title.en && <span className="ml-1 text-xs text-gray-400">{child.title.en}</span>}
            </span>
          </td>
          <td className="p-3 text-[12px] text-gray-400 font-mono">{child.slug}</td>
          <td className="p-3">
            <span className="inline-flex items-center gap-1.5 text-xs text-gray-600">
              {typeIcon(child)} {typeLabel(child)}
            </span>
          </td>
          <td className="p-3">
            <div className="flex gap-1.5">
              <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${child.is_published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                {child.is_published ? '게시' : '비공개'}
              </span>
            </div>
          </td>
          <td className="p-3 pr-4 text-right">
            <div className="flex gap-1 justify-end">
              {child.page_type === 'board' && (
                <Link href={`/admin/menus/${child.id}/posts`} title="게시글 관리" className="text-gray-400 hover:text-blue-600 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
                  <ExternalLink className="w-4 h-4" />
                </Link>
              )}
              <button onClick={() => onEdit(child)} title="수정" className="text-gray-400 hover:text-amber-600 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              <button onClick={() => onDelete(child.id, false)} title="삭제" className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
      ))}
    </>
  );
}
