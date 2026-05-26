import ShortsFeed, { type ShortItem } from '@/components/ShortsFeed';
import { getCachedShorts } from '@/lib/cache/homepage';

const FALLBACK_YT_IDS = ['ho0EhuO3RNs', 'lD1VId0ec2s', 'mkBTUDxMKtU', 'yPRcriD4FcM'];

export default async function ShortsFeedSection({ lang }: { lang: string }) {
  const live = await getCachedShorts();
  const shorts: ShortItem[] = live.length > 0
    ? live.map(d => ({
        embedUrl: `https://www.youtube.com/embed/${d.youtube_id}`,
        productUrl: d.product_id ? `/${lang}/products/${d.product_id}` : undefined,
      }))
    : FALLBACK_YT_IDS.map(id => ({ embedUrl: `https://www.youtube.com/embed/${id}` }));
  return <ShortsFeed shorts={shorts} />;
}

export function ShortsFeedSkeleton() {
  return (
    <section className="py-16 md:py-24 bg-neutral-900">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center mb-10">
          <div className="h-4 w-32 bg-neutral-700 rounded animate-pulse" />
        </div>
        <div className="flex space-x-6 pb-8 justify-center overflow-hidden">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-none w-[260px] h-[460px] rounded-[24px] bg-neutral-800 animate-pulse" />
          ))}
        </div>
      </div>
    </section>
  );
}
