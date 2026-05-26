import ReviewShowcase from '@/components/ReviewShowcase';
import { getCachedReviewCards } from '@/lib/cache/homepage';

export default async function ReviewShowcaseSection({ lang }: { lang: string }) {
  const cards = await getCachedReviewCards();
  return (
    <ReviewShowcase
      cards={cards}
      lang={lang}
      title={lang === 'kr' ? 'REVIEW & COMMUNITY' : 'REVIEWS'}
    />
  );
}

export function ReviewShowcaseSkeleton() {
  return (
    <section className="py-16 md:py-24">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="flex justify-center mb-10">
          <div className="h-6 w-48 bg-neutral-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 md:gap-6">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="aspect-square bg-neutral-100 animate-pulse rounded-lg" />
          ))}
        </div>
      </div>
    </section>
  );
}
