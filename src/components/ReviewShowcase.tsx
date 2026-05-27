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
          <h2 className="text-2xl font-extrabold text-[#111]">{title}</h2>
          {subtitle && <p className="text-sm text-neutral-500 mt-2">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {cards.map(card => {
            const externalHref = card.link_url && card.link_url.trim() !== '' ? card.link_url : null;
            const href = externalHref ?? `/${lang}/reviews/${card.id}`;
            const cardInner = (
              <>
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
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-4">
                    <p className="text-white text-[13px] font-bold line-clamp-2">{card.title}</p>
                  </div>
                )}
              </>
            );

            const cls = 'group relative w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-1rem)] md:w-[calc(25%-1.125rem)] aspect-square overflow-hidden rounded-lg border border-neutral-100 hover:shadow-lg transition-all hover:-translate-y-0.5 block';

            return externalHref ? (
              <a key={card.id} href={externalHref} target="_blank" rel="noopener noreferrer" className={cls}>
                {cardInner}
              </a>
            ) : (
              <Link key={card.id} href={href} className={cls}>
                {cardInner}
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
