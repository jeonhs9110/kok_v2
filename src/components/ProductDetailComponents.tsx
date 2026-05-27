import type { DetailComponent } from '@/lib/api/products';
import { toYouTubeEmbedUrl, isYouTubeShortsUrl } from '@/lib/youtube';

interface Props {
  components: DetailComponent[];
}

export default function ProductDetailComponents({ components }: Props) {
  if (!components || components.length === 0) return null;

  const sorted = [...components].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      {sorted.map(c => {
        if (c.type === 'youtube') {
          const embed = toYouTubeEmbedUrl(c.url);
          if (!embed) return null;
          return (
            <div
              key={c.id}
              className={isYouTubeShortsUrl(c.url) ? 'aspect-[9/16]' : 'aspect-video'}
            >
              <iframe
                src={embed}
                className="w-full h-full block"
                title="Product detail video"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                loading="lazy"
              />
            </div>
          );
        }
        if (c.type === 'video') {
          return (
            <video
              key={c.id}
              src={c.url}
              className="w-full block"
              autoPlay
              muted
              loop
              playsInline
              preload="metadata"
            />
          );
        }
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={c.id}
            src={c.url}
            alt=""
            className="w-full block"
          />
        );
      })}
    </>
  );
}
