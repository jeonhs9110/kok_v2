'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import CommentForm from './CommentForm';
import CommentItem from './CommentItem';
import type { Comment } from '@/lib/api/menus';

interface CommentSectionProps {
  postId: string;
  lang: string;
}

const lb: Record<string, { comments: string; empty: string; write: string }> = {
  kr: { comments: '댓글', empty: '댓글이 없습니다.', write: '댓글 작성' },
  en: { comments: 'Comments', empty: 'No comments yet.', write: 'Write a comment' },
};

export default function CommentSection({ postId, lang }: CommentSectionProps) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const l = lb[lang] ?? lb['en'];

  const fetchComments = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('comments')
      .select('*')
      .eq('post_id', postId)
      .order('created_at', { ascending: true });
    setComments(data || []);
    setLoading(false);
  }, [postId]);

  useEffect(() => { fetchComments(); }, [fetchComments]);

  const topLevel = comments.filter((c) => !c.parent_id);
  const repliesMap = new Map<string, Comment[]>();
  comments.forEach((c) => {
    if (c.parent_id) {
      const arr = repliesMap.get(c.parent_id) || [];
      arr.push(c);
      repliesMap.set(c.parent_id, arr);
    }
  });

  return (
    <div>
      <div className="flex items-center gap-2 mb-6">
        <MessageCircle className="w-5 h-5 text-[#111]" />
        <h2 className="text-lg font-bold text-[#111]">
          {l.comments} <span className="text-neutral-400 font-normal">({comments.length})</span>
        </h2>
      </div>

      {/* Comment Form */}
      <CommentForm postId={postId} lang={lang} onSubmitted={fetchComments} />

      {/* Comment List */}
      {loading ? (
        <div className="py-12 text-center text-neutral-300 text-sm">...</div>
      ) : topLevel.length === 0 ? (
        <div className="py-12 text-center text-neutral-400 text-sm">{l.empty}</div>
      ) : (
        <div className="mt-6 divide-y divide-neutral-100">
          {topLevel.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              replies={repliesMap.get(comment.id) || []}
              lang={lang}
              postId={postId}
              onRefresh={fetchComments}
            />
          ))}
        </div>
      )}
    </div>
  );
}
