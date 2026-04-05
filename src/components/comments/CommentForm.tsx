'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';

interface CommentFormProps {
  postId: string;
  parentId?: string | null;
  lang: string;
  onSubmitted: () => void;
  onCancel?: () => void;
}

const lb: Record<string, { name: string; content: string; submit: string; cancel: string; namePh: string; contentPh: string }> = {
  kr: { name: '이름', content: '내용', submit: '등록', cancel: '취소', namePh: '이름을 입력하세요', contentPh: '내용을 입력하세요' },
  en: { name: 'Name', content: 'Comment', submit: 'Submit', cancel: 'Cancel', namePh: 'Enter your name', contentPh: 'Enter your comment' },
};

export default function CommentForm({ postId, parentId, lang, onSubmitted, onCancel }: CommentFormProps) {
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const l = lb[lang] ?? lb['en'];

  const handleSubmit = async () => {
    if (!authorName.trim() || !content.trim()) return;
    setSubmitting(true);
    try {
      const supabase = createClient();
      const isAdmin = typeof document !== 'undefined' && document.cookie.includes('kokkok_admin_auth=true');
      const { error } = await supabase.from('comments').insert({
        post_id: postId,
        parent_id: parentId || null,
        author_name: authorName.trim(),
        content: content.trim(),
        is_admin_comment: isAdmin,
      });
      if (!error) {
        setAuthorName('');
        setContent('');
        onSubmitted();
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={`${parentId ? 'mt-3' : 'mt-6'} space-y-3`}>
      <input
        type="text"
        value={authorName}
        onChange={(e) => setAuthorName(e.target.value)}
        placeholder={l.namePh}
        className="w-full sm:w-48 border border-neutral-200 px-3 py-2 text-sm rounded bg-neutral-50 focus:bg-white focus:border-[#111] transition outline-none"
      />
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder={l.contentPh}
        rows={parentId ? 2 : 3}
        className="w-full border border-neutral-200 px-3 py-2 text-sm rounded bg-neutral-50 focus:bg-white focus:border-[#111] transition outline-none resize-none"
      />
      <div className="flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={submitting || !authorName.trim() || !content.trim()}
          className="px-4 py-2 bg-[#111] text-white text-xs font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded"
        >
          {submitting ? '...' : l.submit}
        </button>
        {onCancel && (
          <button
            onClick={onCancel}
            className="px-4 py-2 border border-neutral-200 text-neutral-600 text-xs font-bold tracking-wider hover:bg-neutral-50 transition-colors rounded"
          >
            {l.cancel}
          </button>
        )}
      </div>
    </div>
  );
}
