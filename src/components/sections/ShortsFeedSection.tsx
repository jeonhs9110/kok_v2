import ShortsFeed, { type ShortItem } from '@/components/ShortsFeed';
import { getCachedShorts, getCachedShortsBg } from '@/lib/cache/homepage';

export default async function ShortsFeedSection({ lang }: { lang: string }) {
  const [live, bg] = await Promise.all([getCachedShorts(), getCachedShortsBg()]);
  // No placeholder/demo videos — if admin hasn't added shorts, the
  // section is hidden entirely. Previously a FALLBACK_YT_IDS list
  // rendered 4 unrelated demo videos when the DB was empty, which
  // contradicted the admin panel showing "0 shorts" and confused the
  // operator into thinking they were live content.
  if (live.length === 0) return null;
  const shorts: ShortItem[] = live.map(d => ({
    embedUrl: `https://www.youtube.com/embed/${d.youtube_id}`,
    productUrl: d.product_id ? `/${lang}/products/${d.product_id}` : undefined,
  }));
  return <ShortsFeed
    shorts={shorts}
    bgConfig={bg ? {
      type: bg.bg_type,
      color: bg.bg_color,
      media_url: bg.bg_media_url,
      media_type: bg.bg_media_type,
    } : null}
    header={{
      text: bg?.header_text ?? null,
      fontSize: bg?.header_font_size ?? null,
      textColor: bg?.header_text_color ?? null,
      bgColor: bg?.header_bg_color ?? null,
    }}
  />;
}

export function ShortsFeedSkeleton() {
  return (
    <section className="py-16 md:py-24 bg-neutral-900">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-center mb-10">
          <div className="h-4 w-32 bg-neutral-700 rounded animate-pulse motion-reduce:animate-none" />
        </div>
        <div className="flex space-x-6 pb-8 justify-center overflow-hidden">
          {[0, 1, 2].map(i => (
            <div key={i} className="flex-none w-[260px] h-[460px] rounded-[24px] bg-neutral-800 animate-pulse motion-reduce:animate-none" />
          ))}
        </div>
      </div>
    </section>
  );
}
