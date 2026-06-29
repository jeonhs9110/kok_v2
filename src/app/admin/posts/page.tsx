'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Pencil, Trash2, FileText, BookOpen, MessageSquare } from 'lucide-react';
import Link from 'next/link';
import { StatCard, StatStrip, PageHeader, EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import { useConfirm } from '@/components/admin/ConfirmModal';
import { useToast } from '@/components/admin/Toast';
import { formatKstDate } from '@/lib/formatKstDate';
import type { Post, Menu } from '@/lib/api/menus';

type PostWithMenu = Post & { menu_title: string; menu_slug: string };

export default function AllPostsAdminPage() {
  const confirm = useConfirm();
  const toast = useToast();
  const [posts, setPosts] = useState<PostWithMenu[]>([]);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [filterMenuId, setFilterMenuId] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [menusRes, postsRes] = await Promise.all([
        fetch('/api/admin/crud/menus?orderBy=sort_order&direction=ASC', { cache: 'no-store' }),
        fetch('/api/admin/crud/posts?orderBy=created_at&direction=DESC', { cache: 'no-store' }),
      ]);
      const menuList: Menu[] = menusRes.ok ? ((await menusRes.json()) as { rows?: Menu[] }).rows ?? [] : [];
      const postsList: Post[] = postsRes.ok ? ((await postsRes.json()) as { rows?: Post[] }).rows ?? [] : [];
      setMenus(menuList);
      const menuMap = new Map(menuList.map(m => [m.id, m]));
      setPosts(postsList.map(p => {
        const m = menuMap.get(p.menu_id);
        return {
          ...p,
          menu_title: m?.title?.kr || m?.title?.en || '(메뉴 없음)',
          menu_slug: m?.slug || '',
        };
      }));
    } finally {
      setIsLoading(false);
    }
  }, []);

  // One-shot fetch on mount. The lint rule wants an external-store
  // subscription, but there's no live source to subscribe to — we read once
  // and rely on the explicit refetches in mutation handlers.
  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleDelete = async (id: string) => {
    const ok = await confirm({ message: '이 게시글을 삭제하시겠습니까?', tone: 'danger', confirmText: '삭제' });
    if (!ok) return;
    const res = await fetch(`/api/admin/crud/posts?id=${encodeURIComponent(id)}`, { method: 'DELETE' });
    fetchAll();
    toast.show(res.ok ? '게시글이 삭제되었습니다.' : '삭제에 실패했습니다.', res.ok ? 'success' : 'error');
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts.filter(p => {
      if (filterMenuId !== 'all' && p.menu_id !== filterMenuId) return false;
      if (q && !p.title.toLowerCase().includes(q) && !p.author_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [posts, filterMenuId, search]);

  const stats = useMemo(() => {
    const boardMenus = menus.filter(m => m.page_type === 'board').length;
    // Most-populated board — operator's go-to "what board is busy" stat.
    const perBoard: Record<string, number> = {};
    for (const p of posts) perBoard[p.menu_id] = (perBoard[p.menu_id] || 0) + 1;
    const topBoardCount = Math.max(0, ...Object.values(perBoard));
    return {
      total: posts.length,
      boards: boardMenus,
      topBoardCount,
      avg: boardMenus ? Math.round(posts.length / boardMenus) : 0,
    };
  }, [posts, menus]);

  return (
    <div className="space-y-5">
      <StatStrip>
        <StatCard accent="#3b82f6" label="전체 게시글" value={stats.total} icon={FileText} subLabel="모든 게시판 합계" />
        <StatCard accent="#22c55e" label="활성 게시판" value={stats.boards} icon={BookOpen} subLabel="page_type = board" />
        <StatCard accent="#8b5cf6" label="가장 많은 게시판" value={stats.topBoardCount} icon={MessageSquare} subLabel="최대 게시글 수" />
        <StatCard accent="#f59e0b" label="평균 게시글" value={stats.avg} icon={FileText} subLabel="게시판당" />
      </StatStrip>

      <PageHeader
        title="전체 게시글 관리"
        description="모든 게시판의 게시글을 한 곳에서 확인하고 관리합니다"
      />

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

      <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
        {isLoading ? (
          <LoadingState />
        ) : filtered.length === 0 ? (
          <EmptyState label="게시글이 없습니다" />
        ) : (
          <table className="w-full text-left">
            <thead>
              <tr className="bg-[#fafbfc] border-b border-[#e5e7eb] text-[11px] uppercase tracking-wider text-[#6b7280] font-semibold">
                <th className="p-3 pl-4">제목</th>
                <th className="p-3">게시판</th>
                <th className="p-3">작성자</th>
                <th className="p-3">작성일</th>
                <th className="p-3 pr-4 text-right">작업</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f3f4f6]">
              {filtered.map(post => (
                <tr key={post.id} className="hover:bg-[#fafbfc] transition-colors">
                  <td className="p-3 pl-4 text-[12px] font-semibold text-gray-900">
                    <span className="line-clamp-1">{post.title}</span>
                    {post.is_admin_post && <span className="ml-2 px-1.5 py-0.5 text-[10px] font-bold bg-brand-ink text-white rounded">공지</span>}
                  </td>
                  <td className="p-3 text-[12px] text-gray-600">{post.menu_title}</td>
                  <td className="p-3 text-[12px] text-gray-500">{post.author_name}</td>
                  <td className="p-3 text-[12px] text-gray-400">{formatKstDate(post.created_at)}</td>
                  <td className="p-3 pr-4 text-right">
                    <div className="flex gap-1 justify-end">
                      <Link
                        href={`/admin/menus/${post.menu_id}/posts`}
                        title="해당 게시판에서 수정"
                        className="text-gray-400 hover:text-amber-600 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors"
                      >
                        <Pencil className="w-4 h-4" />
                      </Link>
                      <button
                        onClick={() => handleDelete(post.id)}
                        className="text-gray-400 hover:text-red-600 p-1.5 rounded hover:bg-[#f3f4f6] transition-colors"
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
