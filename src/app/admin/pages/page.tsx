'use client';

import { Plus, Trash2, Pencil, X, Eye, EyeOff, Menu as MenuIcon } from 'lucide-react';
import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/api/products';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TiptapLink from '@tiptap/extension-link';
import TiptapImage from '@tiptap/extension-image';

/* ── Constants ─────────────────────────────────────────────────────── */
import { SUPPORTED_LANGS, LANG_LABELS, type Lang } from '@/lib/i18n/types';

type LangMap = Record<string, string>;

/* ── Types ─────────────────────────────────────────────────────────── */
interface Page {
  id: string;
  slug: string;
  title: LangMap;
  content: LangMap;
  is_published: boolean;
  show_in_nav: boolean;
  nav_order: number;
  created_at: string;
}

/* ── TipTap Editor Wrapper ─────────────────────────────────────────── */
function RichEditor({ content, onChange }: { content: string; onChange: (html: string) => void }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TiptapLink.configure({ openOnClick: false }),
      TiptapImage,
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-sm max-w-none min-h-[250px] p-4 focus:outline-none',
      },
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content);
    }
  }, [content]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!editor) return null;

  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
      <div className="flex flex-wrap gap-1 p-2 border-b border-gray-100 bg-gray-50">
        <button type="button" onClick={() => editor.chain().focus().toggleBold().run()}
          className={`px-2.5 py-1.5 text-xs font-bold rounded transition-colors ${editor.isActive('bold') ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>B</button>
        <button type="button" onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`px-2.5 py-1.5 text-xs italic rounded transition-colors ${editor.isActive('italic') ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>I</button>
        <button type="button" onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`px-2.5 py-1.5 text-xs line-through rounded transition-colors ${editor.isActive('strike') ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>S</button>
        <div className="w-px bg-gray-200 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`px-2.5 py-1.5 text-xs font-bold rounded transition-colors ${editor.isActive('heading', { level: 2 }) ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>H2</button>
        <button type="button" onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`px-2.5 py-1.5 text-xs font-bold rounded transition-colors ${editor.isActive('heading', { level: 3 }) ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>H3</button>
        <div className="w-px bg-gray-200 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`px-2.5 py-1.5 text-xs rounded transition-colors ${editor.isActive('bulletList') ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>&#8226; List</button>
        <button type="button" onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`px-2.5 py-1.5 text-xs rounded transition-colors ${editor.isActive('orderedList') ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>1. List</button>
        <div className="w-px bg-gray-200 mx-1" />
        <button type="button" onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`px-2.5 py-1.5 text-xs rounded transition-colors ${editor.isActive('blockquote') ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>&#8220;</button>
        <button type="button" onClick={() => {
          const url = window.prompt('이미지 URL:');
          if (url) editor.chain().focus().setImage({ src: url }).run();
        }} className="px-2.5 py-1.5 text-xs rounded hover:bg-gray-200 transition-colors">Img</button>
        <button type="button" onClick={() => {
          const url = window.prompt('링크 URL:');
          if (url) editor.chain().focus().setLink({ href: url }).run();
          else editor.chain().focus().unsetLink().run();
        }} className={`px-2.5 py-1.5 text-xs rounded transition-colors ${editor.isActive('link') ? 'bg-black text-white' : 'hover:bg-gray-200'}`}>Link</button>
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}

/* ── Main Page ─────────────────────────────────────────────────────── */
export default function PagesAdminPage() {
  const [pages, setPages] = useState<Page[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeLang, setActiveLang] = useState<string>('kr');

  const emptyLangMap = (): LangMap => ({ kr: '', en: '', cn: '', jp: '', vn: '', th: '' });

  const [formData, setFormData] = useState({
    titles: emptyLangMap(),
    slug: '',
    contents: emptyLangMap(),
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
    setFormData({ titles: emptyLangMap(), slug: '', contents: emptyLangMap(), is_published: false, show_in_nav: false, nav_order: 0 });
    setIsSubmitting(false);
  };

  const openEdit = (page: Page) => {
    setEditingId(page.id);
    setActiveLang('kr');
    setFormData({
      titles: { ...emptyLangMap(), ...page.title },
      slug: page.slug,
      contents: { ...emptyLangMap(), ...page.content },
      is_published: page.is_published,
      show_in_nav: page.show_in_nav,
      nav_order: page.nav_order,
    });
    setIsModalOpen(true);
  };

  const autoSlug = (title: string) => {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9가-힣\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .slice(0, 50);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (!supabase) throw new Error('No client');

      // Remove empty lang entries
      const cleanTitles: LangMap = {};
      const cleanContents: LangMap = {};
      for (const l of SUPPORTED_LANGS) {
        if (formData.titles[l]) cleanTitles[l] = formData.titles[l];
        if (formData.contents[l]) cleanContents[l] = formData.contents[l];
      }

      const payload = {
        title: cleanTitles,
        slug: formData.slug,
        content: cleanContents,
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
      alert('페이지 저장에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 페이지를 삭제하시겠습니까?')) return;
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

  const getTitle = (page: Page) => page.title?.kr || page.title?.en || Object.values(page.title || {})[0] || '(제목 없음)';

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div>
          <h2 className="text-lg font-bold text-gray-800">페이지 관리</h2>
          <p className="text-sm text-gray-500 mt-1">메뉴에 표시할 페이지를 추가하고 관리하세요 (다국어 지원)</p>
        </div>
        <button onClick={() => setIsModalOpen(true)}
          className="bg-[#111111] text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-black transition-colors flex items-center gap-2">
          <Plus className="w-4 h-4" /> 새 페이지
        </button>
      </div>

      <div className="overflow-x-auto min-h-[300px]">
        {isLoading ? (
          <div className="p-8 text-center text-sm text-gray-400 font-bold tracking-widest">불러오는 중...</div>
        ) : pages.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="text-sm font-semibold">등록된 페이지가 없습니다</p>
            <p className="text-xs mt-1">새 페이지 버튼을 눌러 이벤트, 브랜드 스토리 등의 페이지를 만드세요</p>
          </div>
        ) : (
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="p-4 pl-6">제목</th>
                <th className="p-4">경로</th>
                <th className="p-4">언어</th>
                <th className="p-4">메뉴</th>
                <th className="p-4">상태</th>
                <th className="p-4 pr-6 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pages.map(page => {
                const filledLangs = SUPPORTED_LANGS.filter(l => page.title?.[l] || page.content?.[l]);
                return (
                  <tr key={page.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="p-4 pl-6 font-bold text-gray-900 text-sm">{getTitle(page)}</td>
                    <td className="p-4 text-gray-500 text-xs font-mono">/pages/{page.slug}</td>
                    <td className="p-4">
                      <div className="flex gap-1">
                        {filledLangs.map(l => (
                          <span key={l} className="px-1.5 py-0.5 bg-gray-100 text-gray-500 text-[9px] font-bold rounded uppercase">{l}</span>
                        ))}
                      </div>
                    </td>
                    <td className="p-4">
                      {page.show_in_nav ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded">
                          <MenuIcon className="w-3 h-3" /> {page.nav_order}
                        </span>
                      ) : (
                        <span className="text-[10px] text-gray-300">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <button onClick={() => togglePublish(page)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors ${
                          page.is_published ? 'bg-green-50 text-green-700 hover:bg-green-100' : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                        }`}>
                        {page.is_published ? <><Eye className="w-3 h-3" /> 게시</> : <><EyeOff className="w-3 h-3" /> 임시</>}
                      </button>
                    </td>
                    <td className="p-4 pr-6 text-right flex gap-1.5 justify-end">
                      <button onClick={() => openEdit(page)} className="text-gray-400 hover:text-blue-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(page.id)} className="text-gray-400 hover:text-red-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Modal ───────────────────────────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[92vh]">
            <div className="p-5 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-lg">{editingId ? '페이지 수정' : '새 페이지'}</h3>
              <button onClick={resetModal} className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
              {/* Slug */}
              <div className="space-y-1">
                <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">URL 경로 (slug) *</label>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-gray-400">/pages/</span>
                  <input
                    required type="text" value={formData.slug}
                    onChange={e => setFormData(prev => ({ ...prev, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') }))}
                    className="flex-1 border border-gray-200 p-2.5 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none font-mono"
                    placeholder="events"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="flex gap-6">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.is_published}
                    onChange={e => setFormData(prev => ({ ...prev, is_published: e.target.checked }))}
                    className="w-4 h-4 rounded accent-black" />
                  <span className="text-sm font-medium text-gray-700">게시 (공개)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={formData.show_in_nav}
                    onChange={e => setFormData(prev => ({ ...prev, show_in_nav: e.target.checked }))}
                    className="w-4 h-4 rounded accent-black" />
                  <span className="text-sm font-medium text-gray-700">헤더 메뉴에 표시</span>
                </label>
                {formData.show_in_nav && (
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-700">순서:</span>
                    <input type="number" min="0" value={formData.nav_order}
                      onChange={e => setFormData(prev => ({ ...prev, nav_order: Number(e.target.value) }))}
                      className="w-16 border border-gray-200 p-1.5 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none text-center" />
                  </div>
                )}
              </div>

              {/* ── Language Tabs ──────────────────────────────────────── */}
              <div className="border border-gray-200 rounded-lg overflow-hidden">
                <div className="flex border-b border-gray-200 bg-gray-50">
                  {SUPPORTED_LANGS.map(l => {
                    const hasContent = !!(formData.titles[l] || formData.contents[l]);
                    return (
                      <button key={l} type="button" onClick={() => setActiveLang(l)}
                        className={`px-4 py-2.5 text-xs font-bold tracking-wide transition-colors relative ${
                          activeLang === l
                            ? 'bg-white text-black border-b-2 border-black -mb-px'
                            : hasContent
                              ? 'text-gray-600 hover:bg-gray-100'
                              : 'text-gray-300 hover:bg-gray-100'
                        }`}>
                        {LANG_LABELS[l]}
                        {hasContent && activeLang !== l && (
                          <span className="ml-1 w-1.5 h-1.5 bg-green-500 rounded-full inline-block" />
                        )}
                      </button>
                    );
                  })}
                </div>

                <div className="p-4 space-y-4">
                  {/* Title for active language */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                      페이지 제목 ({LANG_LABELS[activeLang as Lang]}) {activeLang === 'kr' && '*'}
                    </label>
                    <input
                      type="text"
                      required={activeLang === 'kr'}
                      value={formData.titles[activeLang] || ''}
                      onChange={e => {
                        const val = e.target.value;
                        setFormData(prev => ({
                          ...prev,
                          titles: { ...prev.titles, [activeLang]: val },
                          slug: !editingId && activeLang === 'kr' ? autoSlug(val) : prev.slug,
                        }));
                      }}
                      className="w-full border border-gray-200 p-2.5 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                      placeholder={activeLang === 'kr' ? '예: 이벤트 & 공지사항' : `Title in ${LANG_LABELS[activeLang as Lang]}`}
                    />
                  </div>

                  {/* Content for active language */}
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                      페이지 내용 ({LANG_LABELS[activeLang as Lang]})
                    </label>
                    <RichEditor
                      content={formData.contents[activeLang] || ''}
                      onChange={html => setFormData(prev => ({
                        ...prev,
                        contents: { ...prev.contents, [activeLang]: html },
                      }))}
                    />
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
                <button type="button" onClick={resetModal}
                  className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded text-sm font-semibold hover:bg-gray-50 transition-colors">
                  취소
                </button>
                <button type="submit" disabled={isSubmitting}
                  className="bg-[#111111] text-white px-8 py-2.5 rounded text-sm font-bold tracking-widest hover:bg-black transition-colors disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
                  ) : editingId ? '수정 저장' : '페이지 저장'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
