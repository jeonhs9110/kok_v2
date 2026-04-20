'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import type { ReviewCard } from '@/lib/api/reviews';

interface Props {
  cards: ReviewCard[];
  title?: string;
  subtitle?: string;
}

export default function ReviewShowcase({ cards, title = 'REVIEW & COMMUNITY', subtitle }: Props) {
  const [selected, setSelected] = useState<ReviewCard | null>(null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setSelected(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    document.body.style.overflow = selected ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [selected]);

  if (cards.length === 0) return null;

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-[1240px] mx-auto px-4 sm:px-6">
        <div className="text-center mb-10">
          <h2 className="text-2xl font-extrabold text-[#111]">{title}</h2>
          {subtitle && <p className="text-sm text-neutral-500 mt-2">{subtitle}</p>}
        </div>

        <div className="flex flex-wrap justify-center gap-4 md:gap-6">
          {cards.map(card => (
            <button
              key={card.id}
              type="button"
              onClick={() => {
                if (card.link_url) {
                  window.open(card.link_url, '_blank', 'noopener,noreferrer');
                } else {
                  setSelected(card);
                }
              }}
              className="group relative w-[calc(50%-0.5rem)] sm:w-[calc(33.333%-1rem)] md:w-[calc(25%-1.125rem)] aspect-square overflow-hidden rounded-lg border border-neutral-100 hover:shadow-lg transition-all hover:-translate-y-0.5"
            >
              {card.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={card.image_url}
                  alt={card.title || 'review'}
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
            </button>
          ))}
        </div>
      </div>

      {/* Modal */}
      {selected && (
        <div
          className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-start justify-center overflow-y-auto p-4 animate-in fade-in duration-200"
          onClick={() => setSelected(null)}
        >
          <div
            className="relative bg-white max-w-3xl w-full my-12 rounded-lg shadow-2xl animate-in slide-in-from-top-4 duration-200"
            onClick={e => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setSelected(null)}
              aria-label="Close"
              className="absolute top-3 right-3 w-9 h-9 flex items-center justify-center rounded-full bg-white/80 hover:bg-white text-neutral-700 shadow"
            >
              <X className="w-4 h-4" />
            </button>
            {selected.image_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={selected.image_url}
                alt={selected.title}
                className="w-full max-h-[50vh] object-cover rounded-t-lg"
              />
            )}
            <div className="p-6 md:p-10">
              {selected.title && (
                <h3 className="text-xl md:text-2xl font-extrabold text-[#111] mb-4">{selected.title}</h3>
              )}
              {selected.content_html ? (
                <div
                  className="detail-body"
                  dangerouslySetInnerHTML={{ __html: selected.content_html }}
                />
              ) : (
                <p className="text-neutral-400 text-sm">내용이 없습니다.</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
