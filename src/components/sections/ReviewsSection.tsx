import Image from 'next/image';
import Link from 'next/link';
import { getCachedReviews } from '@/lib/cache/homepage';
import type { Lang } from '@/lib/i18n/types';

const TITLE: Record<Lang, string> = {
  kr: 'REAL REVIEWS',
  en: 'REAL REVIEWS',
};

const VIEW_ALL: Record<Lang, string> = {
  kr: '리뷰 전체 보기 →',
  en: 'View all reviews →',
};

/**
 * Homepage reviews showcase — horizontal strip of the operator's
 * featured review cards. Replaces the previous "reviews only render on
 * /menus/review" arrangement that hid the social proof from the
 * landing page.
 *
 * Card click flows to /[lang]/reviews/{id} for the long read; the same
 * detail route already exists for the /menus/review grid.
 *
 * Hidden when the admin has zero active review cards — the whole
 * section collapses (no empty placeholder), matching how shorts /
 * sub-hero behave when their tables are empty.
 */
export default async function ReviewsSection({ lang }: { lang: Lang }) {
  const reviews = await getCachedReviews();
  if (reviews.length === 0) return null;

  return (
    <section className="kokkok-home-reviews py-16 md:py-24" data-builder-section="reviews">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8 md:mb-10">
          <h2 className="text-xl md:text-2xl font-extrabold tracking-widest text-brand-ink">
            {TITLE[lang]}
          </h2>
          <Link
            href={`/${lang}/menus/review`}
            className="text-[12px] font-semibold text-neutral-500 hover:text-black tracking-wide underline underline-offset-4 transition-colors"
          >
            {VIEW_ALL[lang]}
          </Link>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {reviews.slice(0, 8).map(r => {
            const href = r.link_url
              ? r.link_url
              : `/${lang}/reviews/${r.id}`;
            const external = !!r.link_url && /^https?:\/\//i.test(r.link_url);
            const Card = (
              <div className="relative aspect-[4/5] overflow-hidden rounded-xl bg-neutral-100 group">
                {r.image_url ? (
                  <Image
                    src={r.image_url}
                    alt={r.title || 'review'}
                    fill
                    sizes="(min-width: 1024px) 300px, 50vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full bg-neutral-200" />
                )}
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-3 md:p-4">
                  <p className="text-white text-[13px] md:text-[14px] font-semibold line-clamp-2">
                    {r.title}
                  </p>
                </div>
              </div>
            );
            return external ? (
              <a
                key={r.id}
                href={safeUrl(href)}
                target="_blank"
                rel="noopener noreferrer"
                className="block"
              >
                {Card}
              </a>
            ) : (
              <Link key={r.id} href={safeUrl(href)} className="block">
                {Card}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export function ReviewsSkeleton() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="h-6 w-40 bg-neutral-200 rounded animate-pulse motion-reduce:animate-none mb-10" />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-5">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className="aspect-[4/5] bg-neutral-200 rounded-xl animate-pulse motion-reduce:animate-none"
            />
          ))}
        </div>
      </div>
    </section>
  );
}
