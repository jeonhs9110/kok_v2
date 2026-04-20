import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { notFound } from 'next/navigation';
import { getReviewCard } from '@/lib/api/reviews';

const LABELS: Record<string, { home: string; reviews: string }> = {
  kr: { home: '홈', reviews: 'REVIEW & COMMUNITY' },
  en: { home: 'HOME', reviews: 'REVIEWS' },
  cn: { home: '首页', reviews: '评论' },
  jp: { home: 'ホーム', reviews: 'レビュー' },
  vn: { home: 'TRANG CHỦ', reviews: 'ĐÁNH GIÁ' },
  th: { home: 'หน้าหลัก', reviews: 'รีวิว' },
};

export default async function ReviewDetailPage({
  params,
}: {
  params: Promise<{ lang: string; id: string }>;
}) {
  const { lang, id } = await params;
  const review = await getReviewCard(id);
  if (!review || !review.is_active) notFound();

  const lb = LABELS[lang] ?? LABELS['en'];

  return (
    <div className="bg-white animate-in fade-in duration-500">
      {/* Full-width hero image (if present) */}
      {review.image_url && (
        <div className="w-full bg-neutral-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={review.image_url}
            alt={review.title}
            className="w-full max-h-[60vh] object-cover"
          />
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-10 md:py-16">
        {/* Breadcrumb */}
        <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-8 tracking-widest flex-wrap gap-y-1">
          <Link href={`/${lang}`} className="hover:text-black transition-colors">{lb.home}</Link>
          <ChevronRight className="w-3 h-3 mx-2" />
          <span className="text-[#111111]">{lb.reviews}</span>
          {review.title && (
            <>
              <ChevronRight className="w-3 h-3 mx-2" />
              <span className="text-[#111111] truncate max-w-xs">{review.title}</span>
            </>
          )}
        </div>

        {/* Title */}
        {review.title && (
          <div className="mb-10 pb-8 border-b border-neutral-200">
            <h1 className="text-3xl md:text-4xl font-black tracking-tight text-[#111111] leading-tight">
              {review.title}
            </h1>
          </div>
        )}

        {/* Body — HTML rendered with the same styles as 제품 상세 body */}
        {review.content_html ? (
          <div
            className="detail-body"
            dangerouslySetInnerHTML={{ __html: review.content_html }}
          />
        ) : (
          <p className="text-neutral-400 text-sm">내용이 없습니다.</p>
        )}

        {/* Back link */}
        <div className="mt-16 pt-8 border-t border-neutral-100">
          <Link
            href={`/${lang}`}
            className="inline-flex items-center gap-2 text-sm text-neutral-500 hover:text-black transition-colors"
          >
            ← {lb.home}
          </Link>
        </div>
      </div>
    </div>
  );
}
