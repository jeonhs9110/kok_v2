import Link from 'next/link';
import type { ReviewCard } from '@/lib/api/reviews';

interface Props {
  cards: ReviewCard[];
  title?: string;
  subtitle?: string;
  lang: string;
}

export default function ReviewShowcase({ cards, title = 'REVIEW & COMMUNITY', subtitle, lang }: Props) {
  if (cards.length === 0) return null;

  return (
    <section className="py-16 md:py-24">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-extrabold text-brand-ink">{title}</h2>
          {subtitle && <p className="text-sm text-neutral-500 mt-2">{subtitle}</p>}
        </div>

        {/* Cards always link to the internal review viewer at
            /[lang]/reviews/[id]. The link_url field on the row still
            holds the original Naver source for attribution (rendered
            as a small footer link on the viewer page), but the click
            shouldn't jump customers off-site mid-browse — they should
            see the post body inline with kokkok's typography. */}
        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {cards.map(card => (
            <Link
              key={card.id}
              href={`/${lang}/reviews/${card.id}`}
              className="group relative w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-1rem)] md:w-[calc(25%-1.125rem)] aspect-square overflow-hidden rounded-lg border border-neutral-100 hover:shadow-lg transition-all hover:-translate-y-0.5 block"
            >
              {card.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image_url}
                  alt={card.title || (lang === 'kr' ? '리뷰 카드' : 'Customer review')}
                  width={400}
                  height={400}
                  loading="lazy"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-neutral-100 text-neutral-400 text-sm">
                  {card.title || 'REVIEW'}
                </div>
              )}
              {card.title && (
                /* Gradient lightened from from-black/70 → from-black/50
                   and only covers the bottom 40% of the card so the
                   thumbnail artwork is visible above it. 송이's testing
                   pointed out the old gradient hid most of the image. */
                <div className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/50 to-transparent flex items-end p-4">
                  <p className="text-white text-[13px] font-bold line-clamp-2 drop-shadow-md">{card.title}</p>
                </div>
              )}
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
