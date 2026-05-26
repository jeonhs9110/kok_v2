import type { DetailComponent } from '@/lib/api/products';
import { detectEmbed } from '@/lib/embed';

interface Props {
  components: DetailComponent[];
}

export default function ProductDetailComponents({ components }: Props) {
  if (!components || components.length === 0) return null;

  const sorted = [...components].sort((a, b) => a.sort_order - b.sort_order);

  return (
    <>
      {sorted.map(c => {
        if (c.type === 'youtube' || c.type === 'tiktok' || c.type === 'instagram') {
          const info = detectEmbed(c.url);
          if (!info) return null;
          return (
            <div key={c.id} className={info.aspectClass}>
              <iframe
                src={info.embedUrl}
                className="w-full h-full block"
                title={`${info.label} embed`}
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
