'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/api/products';
import type { Post, Menu } from '@/lib/api/menus';

type PostWithMenu = Post & { menu_title: string; menu_slug: string };

export default function AllPostsAdminPage() {
  const [posts, setPosts] = useState<PostWithMenu[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [filterMenuId, setFilterMenuId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    if (!supabase) { setIsLoading(false); return; }
    const [{ data: menuData }, { data: postsData }] = await Promise.all([
      supabase.from('menus').select('*').order('sort_order', { ascending: true }),
      supabase.from('posts').select('*').order('created_at', { ascending: false }),
    ]);
    const menuList = (menuData ?? []) as Menu[];
    setMenus(menuList);
    const menuMap = new Map(menuList.map(m => [m.id, m]));
    setPosts((postsData ?? []).map((p: Post) => {
      const m = menuMap.get(p.menu_id);
      return {
        ...p,
        menu_title: m?.title?.kr || m?.title?.en || '(메뉴 없음)',
        menu_slug: m?.slug || '',
      };
    }));
    setIsLoading(false);
  }, []);

  // One-shot fetch on mount. The lint rule wants an external-store
  // subscription, but there's no live source to subscribe to — we read once
  // and rely on the explicit refetches in mutation handlers.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id: string) => {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return;
    if (!supabase) return;
    await supabase.from('posts').delete().eq('id', id);
    fetchAll();
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter(p => {
      if (filterMenuId !== 'all' && p.menu_id !== filterMenuId) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.author_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, filterMenuId, search]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-bold text-gray-800">전체 게시글 관리</h2>
        <p className="text-sm text-gray-500">모든 게시판의 게시글을 한 곳에서 확인하고 관리합니다.</p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterMenuId}
          onChange={e => setFilterMenuId(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-black/5"
        >
          <option value="all">전체 게시판</option>
          {menus.filter(m => m.page_type === 'board').map(m => (
            <option key={m.id} value={m.id}>{m.title?.kr || m.title?.en || m.slug}</option>
          ))}
        </select>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="제목 / 작성자 검색"
          className="flex-1 min-w-[240px] border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-black/5"
        />
        <span className="text-xs text-gray-400">총 {filtered.length.toLocaleString()}건</span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {isLoading ? (
          <div className="p-12 text-center text-gray-400 text-sm font-bold tracking-widest">불러오는 중...</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <p className="font-semibold">게시글이 없습니다</p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-500 font-semibold">
                <th className="p-4 pl-6">제목</th>
                <th className="p-4">게시판</th>
                <th className="p-4">작성자</th>
                <th className="p-4">작성일</th>
                <th className="p-4 pr-6 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map(post => (
                <tr key={post.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="p-4 pl-6 text-sm font-semibold text-gray-900">
                    <span className="line-clamp-1">{post.title}</span>
                    {post.is_admin_post && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-[#111] text-white rounded">공지</span>}
                  </td>
                  <td className="p-4 text-sm text-gray-600">{post.menu_title}</td>
                  <td className="p-4 text-sm text-gray-500">{post.author_name}</td>
                  <td className="p-4 text-sm text-gray-400">{new Date(post.created_at).toLocaleDateString('ko-KR')}</td>
                  <td className="p-4 pr-6 text-right">
                    <div className="flex gap-1 justify-end">
                      <Link
                        href={`/admin/menus/${post.menu_id}/posts`}
                        title="해당 게시판에서 수정"
                        className="text-gray-400 hover:text-amber-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-100 transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="text-gray-400 hover:text-red-600 bg-white p-1.5 rounded-md shadow-sm border border-gray-100 transition-colors"
                      >
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
    </div>
  );
}
