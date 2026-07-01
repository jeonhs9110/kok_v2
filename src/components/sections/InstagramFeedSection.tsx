import InstagramSection from '@/components/InstagramSection';
import { getCachedInstagram } from '@/lib/cache/homepage';

export default async function InstagramFeedSection({ lang }: { lang?: string } = {}) {
  const data = await getCachedInstagram();
  return <InstagramSection data={data} lang={lang} />;
}

// Reserve the LARGER layout (embed grid) regardless of whether any post
// will turn out to be an iframe. The real section flips between
// grid-cols-3/6 (square thumbnails) and grid-cols-2/3 (4:5 embeds);
// using the small layout in skeleton causes a ~600px CLS jump on
// embed-flavored loads. Trade-off: a few px taller on no-embed path.
export function InstagramFeedSkeleton() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center mb-10">
          <div className="h-6 w-40 bg-neutral-200 rounded animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {[0, 1, 2].map(i => (
            <div key={i} className="aspect-[4/5] bg-neutral-100 animate-pulse motion-reduce:animate-none rounded-lg" />
          ))}
        </div>
      </div>
    </section>
  );
}
