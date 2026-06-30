'use client';

import { useState } from 'react';

interface CommentFormProps {
  postId: string;
  parentId?: string | null;
  lang: string;
  onSubmitted: () => void;
  onCancel?: () => void;
}

const lb: Record<string, { name: string; content: string; submit: string; cancel: string; namePh: string; contentPh: string; error: string }> = {
  kr: { name: '이름', content: '내용', submit: '등록', cancel: '취소', namePh: '이름을 입력하세요', contentPh: '내용을 입력하세요', error: '댓글 등록에 실패했어요. 잠시 후 다시 시도해주세요.' },
  en: { name: 'Name', content: 'Comment', submit: 'Submit', cancel: 'Cancel', namePh: 'Enter your name', contentPh: 'Enter your comment', error: 'Could not submit your comment. Please try again.' },
};

export default function CommentForm({ postId, parentId, lang, onSubmitted, onCancel }: CommentFormProps) {
  const [authorName, setAuthorName] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const l = lb[lang] ?? lb['en'];

  const handleSubmit = async () => {
    if (!authorName.trim() || !content.trim()) return;
    setSubmitting(true);
    setError(null);
    try {
      const isAdmin = typeof document !== 'undefined' && document.cookie.includes('kokkok_admin_auth=true');
      // Admin "notice"-style comments (is_admin_comment=true) only
      // possible via the admin route; everyone else uses the customer
      // route which forces is_admin_comment=false.
      const endpoint = isAdmin ? '/api/admin/comments' : '/api/customer/comments';
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          post_id: postId,
          parent_id: parentId || null,
          author_name: authorName.trim(),
          content: content.trim(),
          ...(isAdmin ? { is_admin_comment: true } : {}),
        }),
      });
      // Surface failures: previously a non-OK response or a network
      // error left the form populated but with no signal. The reader
      // expected to see their comment after the parent's onSubmitted
      // refetch, didn't, and assumed the system ate it (correct guess —
      // but they had no way to retry). Now: show an inline error AND
      // keep the typed text so the customer can fix or retry.
      if (!res.ok) {
        setError(l.error);
        return;
      }
      setAuthorName('');
      setContent('');
      onSubmitted();
    } catch (err) {
      console.error('[comments] submit failed:', err);
      setError(l.error);
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
          className="px-4 py-2 bg-brand-ink text-white text-xs font-bold tracking-wider hover:bg-black transition-colors disabled:opacity-40 disabled:cursor-not-allowed rounded"
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
      {error && (
        <p role="alert" aria-live="polite" className="text-xs text-red-500 font-semibold">
          {error}
        </p>
      )}
    </div>
  );
}
