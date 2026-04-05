'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, X, ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/api/products';
import type { Post, Menu } from '@/lib/api/menus';

export default function PostsAdminPage() {
  const { menuId } = useParams<{ menuId: string }>();
  const [menu, setMenu] = useState<Menu | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ title: '', content: '', author_name: '관리자' });

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    if (!supabase) return;
    const { data: menuData } = await supabase.from('menus').select('*').eq('id', menuId).single();
    if (menuData) setMenu(menuData);
    const { data: postsData } = await supabase.from('posts').select('*').eq('menu_id', menuId).order('created_at', { ascending: false });
    setPosts(postsData ?? []);
    setIsLoading(false);
  }, [menuId]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const resetForm = () => {
    setModalOpen(false);
    setEditingId(null);
    setForm({ title: '', content: '', author_name: '관리자' });
  };

  const openEdit = (p: Post) => {
    setEditingId(p.id);
    setForm({ title: p.title, content: p.content, author_name: p.author_name });
    setModalOpen(true);
  };

  const handleSave = async () => {
    if (!supabase || !form.title.trim()) return;
    const payload = { ...form, menu_id: menuId, is_admin_post: true, is_published: true, updated_at: new Date().toISOString() };
    try {
      if (editingId) {
        await supabase.from('posts').update(payload).eq('id', editingId);
      } else {
        await supabase.from('posts').insert(payload);
      }
      resetForm();
      fetchAll();
    } catch { alert('저장 실패'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
    if (!supabase) return;
    await supabase.from('posts').delete().eq('id', id);
    fetchAll();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/admin/menus" className="text-gray-400 hover:text-black transition-colors"><ArrowLeft className="w-5 h-5" /></Link>
        <div>
          <h2 className="text-lg font-bold text-gray-800">{menu?.title?.kr || '게시판'} — 게시글 관리</h2>
          <p className="text-sm text-gray-500">이 게시판의 게시글을 관리합니다.</p>
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => { setEditingId(null); setForm({ title: '', content: '', author_name: '관리자' }); setModalOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-[#111] text-white text-sm font-semibold rounded-lg hover:bg-black transition-colors">
          <Plus className="w-4 h-4" /> 게시글 추가
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm font-bold tracking-widest">불러오는 중...</div>
        ) : posts.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="font-semibold">게시글이 없습니다</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="p-4 pl-6">제목</th>
                <th className="p-4">작성자</th>
                <th className="p-4">작성일</th>
                <th className="p-4 pr-6 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {posts.map(post => (
                <tr key={post.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 pl-6 text-sm font-semibold text-gray-900">{post.title}</td>
                  <td className="p-4 text-sm text-gray-500">{post.author_name}</td>
                  <td className="p-4 text-sm text-gray-400">{new Date(post.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex gap-1 justify-end">
                      <button onClick={() => openEdit(post)} className="text-gray-400 hover:text-amber-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-100 transition-colors">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(post.id)} className="text-gray-400 hover:text-red-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-100 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={resetForm}>
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold">{editingId ? '게시글 수정' : '게시글 추가'}</h3>
              <button onClick={resetForm} className="text-gray-400 hover:text-black"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">제목 *</label>
                <input type="text" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">작성자</label>
                <input type="text" value={form.author_name} onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))} className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1.5">내용</label>
                <textarea rows={10} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="게시글 내용을 입력하세요..." className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-black/5 resize-none" />
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={resetForm} className="px-4 py-2.5 text-sm text-gray-600">취소</button>
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
