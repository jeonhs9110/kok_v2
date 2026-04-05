'use client';

import { useState, useMemo } from 'react';
import { MessageSquare, Trash2 } from 'lucide-react';
import CommentForm from './CommentForm';
import type { Comment } from '@/lib/api/menus';
import { createClient } from '@/lib/supabase/client';

interface CommentItemProps {
  comment: Comment;
  replies: Comment[];
  lang: string;
  postId: string;
  onRefresh: () => void;
  isReply?: boolean;
}

const lb: Record<string, { reply: string; delete: string; confirmDelete: string; admin: string }> = {
  kr: { reply: '답글', delete: '삭제', confirmDelete: '댓글을 삭제하시겠습니까?', admin: '관리자' },
  en: { reply: 'Reply', delete: 'Delete', confirmDelete: 'Delete this comment?', admin: 'Admin' },
};

export default function CommentItem({ comment, replies, lang, postId, onRefresh, isReply }: CommentItemProps) {
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const l = lb[lang] ?? lb['en'];

  const isAdmin = useMemo(() =>
    typeof document !== 'undefined' && document.cookie.includes('kokkok_admin_auth=true'),
  []);

  const handleDelete = async () => {
    if (!confirm(l.confirmDelete)) return;
    setDeleting(true);
    try {
      const supabase = createClient();
      await supabase.from('comments').delete().eq('id', comment.id);
      onRefresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className={isReply ? 'ml-8 pl-4 border-l-2 border-neutral-100' : ''}>
      <div className="py-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-1.5">
          <span className="text-[13px] font-semibold text-[#111]">{comment.author_name}</span>
          {comment.is_admin_comment && (
            <span className="px-1.5 py-0.5 text-[9px] font-bold bg-[#111] text-white rounded">{l.admin}</span>
          )}
          <span className="text-xs text-neutral-400">{new Date(comment.created_at).toLocaleDateString('ko-KR')}</span>
        </div>

        {/* Content */}
        <p className="text-sm text-neutral-700 whitespace-pre-wrap">{comment.content}</p>

        {/* Actions */}
        <div className="flex items-center gap-3 mt-2">
          {!isReply && (
            <button
              onClick={() => setShowReplyForm(!showReplyForm)}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-[#111] transition-colors"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {l.reply}
            </button>
          )}
          {isAdmin && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1 text-xs text-neutral-400 hover:text-red-500 transition-colors disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {l.delete}
            </button>
          )}
        </div>

        {/* Reply Form */}
        {showReplyForm && (
          <CommentForm
            postId={postId}
            parentId={comment.id}
            lang={lang}
            onSubmitted={() => { setShowReplyForm(false); onRefresh(); }}
            onCancel={() => setShowReplyForm(false)}
          />
        )}
      </div>

      {/* Replies */}
      {replies.map((reply) => (
        <CommentItem
          key={reply.id}
          comment={reply}
          replies={[]}
          lang={lang}
          postId={postId}
          onRefresh={onRefresh}
          isReply
        />
      ))}
    </div>
  );
}
