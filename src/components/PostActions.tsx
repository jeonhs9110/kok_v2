'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface PostActionsProps {
  postId: string;
  authorId: string | null;
  isAdminPost: boolean;
  slug: string;
  lang: string;
}

export default function PostActions({ postId, authorId, isAdminPost, slug, lang }: PostActionsProps) {
  const router = useRouter();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const isAdmin = useMemo(() =>
    typeof document !== 'undefined' && document.cookie.includes('kokkok_admin_auth=true'),
  []);

  useEffect(() => {
    const getUser = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (user) setCurrentUserId(user.id);
    };
    getUser();
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
      const supabase = createClient();
      const { error } = await supabase.from('posts').delete().eq('id', postId);
      if (error) throw error;
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
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-neutral-500 border border-neutral-200 hover:bg-neutral-50 hover:text-[#111] transition-colors rounded"
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
