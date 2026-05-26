import Link from 'next/link';

export interface PromoBanner {
  id: string;
  image_url: string;
  link_url: string;
  sort_order: number;
}

interface Props {
  banners: PromoBanner[];
}

export default function PromoBannersSection({ banners }: Props) {
  if (!banners || banners.length === 0) return null;

  // Show at most 2 banners
  const display = banners.slice(0, 2);

  return (
    <section className="py-8 md:py-12">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-2 gap-3 md:gap-5">
          {display.map((banner) => (
            <Link
              key={banner.id}
              href={banner.link_url || '#'}
              target={banner.link_url?.startsWith('http') ? '_blank' : undefined}
              rel={banner.link_url?.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="relative block aspect-square overflow-hidden rounded-xl group isolate"
            >
              {banner.image_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={banner.image_url}
                  alt="프로모션 배너"
                  width={800}
                  height={800}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
                />
              ) : (
                <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-400 text-sm">
                  배너 이미지 없음
                </div>
              )}
              {/* Hover overlay */}
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
