import InstagramSection from '@/components/InstagramSection';
import { getCachedInstagram } from '@/lib/cache/homepage';

export default async function InstagramFeedSection() {
  const data = await getCachedInstagram();
  return <InstagramSection data={data} />;
}

export function InstagramFeedSkeleton() {
  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center mb-10">
          <div className="h-6 w-40 bg-neutral-200 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div key={i} className="aspect-square bg-neutral-100 animate-pulse" />
          ))}
        </div>
      </div>
    </section>
  );
}
