'use client';

import { useCallback, useEffect, useState } from 'react';
import { Star, Loader2, MessageCircle } from 'lucide-react';
import { supabase } from '@/lib/api/products';

interface ProductReview {
  id: string;
  product_id: string;
  author_name: string;
  rating: number;
  title: string | null;
  content: string;
  created_at: string;
}

interface Props {
  productId: string;
  lang: string;
}

const LABELS: Record<string, {
  heading: string; empty: string; write: string;
  name: string; rating: string; title: string; content: string;
  submit: string; submitting: string; submitted: string; failed: string;
  required: string;
}> = {
  kr: {
    heading: '리뷰',
    empty: '아직 등록된 리뷰가 없습니다. 첫 리뷰를 작성해주세요.',
    write: '리뷰 작성',
    name: '이름', rating: '평점', title: '제목 (선택)', content: '리뷰 내용',
    submit: '리뷰 등록', submitting: '등록 중...', submitted: '리뷰가 등록되었습니다.',
    failed: '등록에 실패했습니다. 잠시 후 다시 시도해주세요.',
    required: '이름과 리뷰 내용은 필수입니다.',
  },
  en: {
    heading: 'Reviews',
    empty: 'No reviews yet. Be the first to review this product.',
    write: 'Write a Review',
    name: 'Name', rating: 'Rating', title: 'Title (optional)', content: 'Review',
    submit: 'Submit Review', submitting: 'Submitting...', submitted: 'Your review has been posted.',
    failed: 'Submission failed. Please try again.',
    required: 'Name and review content are required.',
  },
};

function StarRow({ value, onChange, size = 18 }: { value: number; onChange?: (v: number) => void; size?: number }) {
  return (
    <div className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(n => (
        <button
          key={n}
          type="button"
          onClick={() => onChange?.(n)}
          className={onChange ? 'cursor-pointer' : 'cursor-default'}
          disabled={!onChange}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
        >
          <Star
            width={size}
            height={size}
            className={n <= value ? 'fill-amber-400 stroke-amber-400' : 'fill-neutral-200 stroke-neutral-300'}
          />
        </button>
      ))}
    </div>
  );
}

export default function ProductReviewSection({ productId, lang }: Props) {
  const lb = LABELS[lang] ?? LABELS['en'];
  const [reviews, setReviews] = useState<ProductReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [form, setForm] = useState({ author_name: '', rating: 5, title: '', content: '' });

  const load = useCallback(async () => {
    setLoading(true);
    if (!supabase) { setReviews([]); setLoading(false); return; }
    const { data } = await supabase
      .from('product_reviews')
      .select('*')
      .eq('product_id', productId)
      .eq('is_published', true)
      .order('created_at', { ascending: false });
    setReviews(data ?? []);
    setLoading(false);
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.author_name.trim() || !form.content.trim()) {
      setFeedback({ kind: 'error', text: lb.required });
      return;
    }
    if (!supabase) return;
    setSubmitting(true);
    const { error } = await supabase.from('product_reviews').insert({
      product_id: productId,
      author_name: form.author_name.trim(),
      rating: form.rating,
      title: form.title.trim() || null,
      content: form.content.trim(),
    });
    setSubmitting(false);
    if (error) {
      setFeedback({ kind: 'error', text: lb.failed });
      return;
    }
    setFeedback({ kind: 'success', text: lb.submitted });
    setForm({ author_name: '', rating: 5, title: '', content: '' });
    setShowForm(false);
    load();
  };

  const avgRating = reviews.length === 0 ? 0
    : Math.round((reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length) * 10) / 10;

  return (
    <div className="mt-24 pt-16 border-t border-neutral-100">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <MessageCircle className="w-5 h-5 text-[#111]" />
            <h2 className="text-lg font-bold tracking-widest uppercase text-[#111]">
              {lb.heading} <span className="text-neutral-400 font-normal">({reviews.length})</span>
            </h2>
            {reviews.length > 0 && (
              <div className="flex items-center gap-2 ml-3">
                <StarRow value={Math.round(avgRating)} size={16} />
                <span className="text-sm font-semibold text-neutral-700">{avgRating.toFixed(1)}</span>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => { setShowForm(v => !v); setFeedback(null); }}
            className="px-4 py-2 bg-[#111] text-white text-xs font-bold tracking-widest hover:bg-black transition-colors"
          >
            {lb.write}
          </button>
        </div>

        {showForm && (
          <form onSubmit={submit} className="mb-10 border border-neutral-200 p-5 space-y-4 bg-neutral-50/50">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{lb.name} *</label>
                <input
                  type="text"
                  value={form.author_name}
                  onChange={e => setForm(f => ({ ...f, author_name: e.target.value }))}
                  className="w-full mt-1 border border-neutral-200 bg-white p-2 text-sm rounded outline-none focus:border-black"
                  required
                />
              </div>
              <div>
                <label className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase block mb-1">{lb.rating} *</label>
                <StarRow value={form.rating} onChange={v => setForm(f => ({ ...f, rating: v }))} size={22} />
              </div>
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{lb.title}</label>
              <input
                type="text"
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="w-full mt-1 border border-neutral-200 bg-white p-2 text-sm rounded outline-none focus:border-black"
              />
            </div>
            <div>
              <label className="text-[10px] font-bold tracking-widest text-neutral-500 uppercase">{lb.content} *</label>
              <textarea
                value={form.content}
                onChange={e => setForm(f => ({ ...f, content: e.target.value }))}
                rows={4}
                className="w-full mt-1 border border-neutral-200 bg-white p-2 text-sm rounded outline-none focus:border-black resize-y"
                required
              />
            </div>
            {feedback && (
              <p className={`text-xs ${feedback.kind === 'error' ? 'text-red-600' : 'text-green-600'}`}>{feedback.text}</p>
            )}
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center gap-2 bg-[#111] text-white px-6 py-2.5 text-xs font-bold tracking-widest hover:bg-black transition-colors disabled:opacity-50"
              >
                {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {submitting ? lb.submitting : lb.submit}
              </button>
            </div>
          </form>
        )}

        {loading ? (
          <div className="py-12 text-center text-neutral-300 text-sm">...</div>
        ) : reviews.length === 0 ? (
          <div className="py-12 text-center text-neutral-400 text-sm">{lb.empty}</div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {reviews.map(r => (
              <li key={r.id} className="py-5">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2.5">
                    <StarRow value={r.rating} size={14} />
                    <span className="text-sm font-semibold text-[#111]">{r.author_name}</span>
                  </div>
                  <span className="text-[11px] text-neutral-400">
                    {new Date(r.created_at).toLocaleDateString(lang === 'kr' ? 'ko-KR' : 'en-US')}
                  </span>
                </div>
                {r.title && <p className="text-sm font-bold text-[#111] mb-1">{r.title}</p>}
                <p className="text-sm text-neutral-700 leading-relaxed whitespace-pre-line break-words">
                  {r.content}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
