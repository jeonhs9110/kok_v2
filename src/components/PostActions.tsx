'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';

interface PostActionsProps {
  postId: string;
  authorId: string | null;
  slug: string;
  lang: string;
}

/**
 * Edit / delete buttons on a community-board post detail page. Talks to
 * /api/customer/me to learn the signed-in user, /api/customer/posts/[id]
 * to delete; an admin route (separate) handles cross-user delete via
 * /api/admin/posts/[id]. Cookie `kokkok_admin_auth=true` still toggles
 * the admin path locally for the operator preview view.
 */
export default function PostActions({ postId, authorId, slug, lang }: PostActionsProps) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = useMemo(() =>
    typeof document !== 'undefined' && document.cookie.includes('kokkok_admin_auth=true'),
  []);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/customer/me', { cache: 'no-store' });
        if (!res.ok) return;
        const json = (await res.json()) as { userId: string };
        setCurrentUserId(json.userId);
      } catch { /* ignore */ }
    })();
  }, []);

  const isOwner = currentUserId && authorId && currentUserId === authorId;
  const canEdit = isOwner || isAdmin;
  const canDelete = isOwner || isAdmin;

  if (!canEdit && !canDelete) return null;

  const handleDelete = async () => {
    const msg = lang === 'kr' ? '이 게시글을 삭제하시겠습니까?' : 'Delete this post?';
    if (!confirm(msg)) return;
    setDeleting(true);
    try {
      const endpoint = isOwner ? `/api/customer/posts/${postId}` : `/api/admin/posts/${postId}`;
      const res = await fetch(endpoint, { method: 'DELETE' });
      if (!res.ok) throw new Error('http_' + res.status);
      router.push(`/${lang}/menus/${slug}`);
    } catch {
      alert(lang === 'kr' ? '삭제에 실패했습니다.' : 'Failed to delete.');
      setDeleting(false);
    }
  };

  return (
    <div className="flex gap-2">
      {canEdit && (
        <button
          onClick={() => router.push(`/${lang}/menus/${slug}/${postId}/edit`)}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-500 border border-neutral-200 hover:bg-neutral-50 hover:text-brand-ink transition-colors rounded"
        >
          <Pencil className="w-3.5 h-3.5" />
          {lang === 'kr' ? '수정' : 'Edit'}
        </button>
      )}
      {canDelete && (
        <button
          onClick={handleDelete}
          disabled={deleting}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-500 border border-neutral-200 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors rounded disabled:opacity-40"
        >
          <Trash2 className="w-3.5 h-3.5" />
          {deleting ? '...' : lang === 'kr' ? '삭제' : 'Delete'}
        </button>
      )}
    </div>
  );
}
