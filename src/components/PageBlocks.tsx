import Link from 'next/link';
import Image from 'next/image';
import type { PageBlock } from '@/lib/pages/blocks';

/**
 * Public storefront renderer for the page-builder block array. Imported by
 * src/app/[lang]/pages/[slug]/page.tsx. Server component — the blocks
 * arrive pre-translated to the visitor's language by the caller.
 *
 * Each block type maps to a small, self-contained block of JSX. Visual
 * defaults follow the storefront's existing card/section styling so a
 * built page doesn't feel grafted on.
 */
export default function PageBlocks({ blocks }: { blocks: PageBlock[] }) {
  if (!blocks.length) return null;
  return (
    <div className="space-y-12 sm:space-y-16 py-8 sm:py-12">
      {blocks.map((block, i) => (
        <BlockRenderer key={i} block={block} index={i} />
      ))}
    </div>
  );
}

function BlockRenderer({ block, index }: { block: PageBlock; index: number }) {
  switch (block.type) {
    case 'hero':
      return <HeroBlock block={block} priority={index === 0} />;
    case 'text':
      return <TextBlock block={block} />;
    case 'image':
      return <ImageBlock block={block} priority={index === 0} />;
    case 'cta':
      return <CtaBlock block={block} />;
    case 'embed':
      return <EmbedBlock block={block} />;
  }
}

function HeroBlock({
  block,
  priority,
}: {
  block: Extract<PageBlock, { type: 'hero' }>;
  priority: boolean;
}) {
  const layout = block.layout ?? 'image-right';
  const wrapperStyle = { backgroundColor: block.bg_color || '#f5f5f5', color: block.text_color || '#111' };

  if (layout === 'fullbleed') {
    return (
      <section className="relative w-full aspect-[16/9] sm:aspect-[21/9] overflow-hidden rounded-xl" style={wrapperStyle}>
        {block.image_url && (
          <Image
            src={block.image_url}
            alt=""
            fill
            sizes="100vw"
            priority={priority}
            className="object-cover"
          />
        )}
        <div className="absolute inset-0 flex items-center">
          <div className="max-w-[1400px] mx-auto w-full px-6 sm:px-12">
            <div className="max-w-xl">
              {block.title && (
                <h2
                  className="text-3xl sm:text-5xl font-extrabold leading-tight whitespace-pre-line drop-shadow-lg mb-3"
                  style={{ color: block.text_color || '#ffffff' }}
                >
                  {block.title}
                </h2>
              )}
              {block.subtitle && (
                <p className="text-sm sm:text-lg drop-shadow-md mb-6" style={{ color: block.text_color || 'rgba(255,255,255,0.9)' }}>
                  {block.subtitle}
                </p>
              )}
              {block.cta_text && block.cta_link && (
                <Link
                  href={block.cta_link}
                  className="inline-flex items-center gap-2 px-8 py-3.5 bg-white text-black text-[13px] font-bold tracking-wider hover:bg-neutral-100 transition-colors rounded-full"
                >
                  {block.cta_text}
                </Link>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  // image-right layout
  return (
    <section className="rounded-xl overflow-hidden grid grid-cols-1 md:grid-cols-2 gap-0" style={wrapperStyle}>
      <div className="p-8 sm:p-12 flex flex-col justify-center">
        {block.title && (
          <h2
            className="text-2xl sm:text-4xl font-extrabold leading-tight whitespace-pre-line mb-3"
            style={{ color: block.text_color || '#111' }}
          >
            {block.title}
          </h2>
        )}
        {block.subtitle && (
          <p className="text-sm sm:text-base mb-6" style={{ color: block.text_color || '#444' }}>
            {block.subtitle}
          </p>
        )}
        {block.cta_text && block.cta_link && (
          <Link
            href={block.cta_link}
            className="inline-flex items-center gap-2 self-start px-6 py-3 bg-brand-ink text-white text-[12px] font-bold tracking-wider hover:bg-black transition-colors"
          >
            {block.cta_text}
          </Link>
        )}
      </div>
      <div className="relative min-h-[280px] sm:min-h-[420px] bg-neutral-100">
        {block.image_url && (
          <Image
            src={block.image_url}
            alt=""
            fill
            sizes="(max-width: 768px) 100vw, 50vw"
            priority={priority}
            className="object-cover"
          />
        )}
      </div>
    </section>
  );
}

function TextBlock({ block }: { block: Extract<PageBlock, { type: 'text' }> }) {
  if (!block.html.trim()) return null;
  return (
    <section className="max-w-3xl mx-auto px-4 sm:px-6">
      <div
        className="prose prose-neutral max-w-none text-[15px] leading-relaxed text-neutral-700"
        dangerouslySetInnerHTML={{ __html: block.html }}
      />
    </section>
  );
}

function ImageBlock({
  block,
  priority,
}: {
  block: Extract<PageBlock, { type: 'image' }>;
  priority: boolean;
}) {
  if (!block.image_url) return null;
  const maxWidth = block.max_width ?? 1200;
  const content = (
    <figure className="mx-auto" style={{ maxWidth }}>
      <div className="relative w-full aspect-[16/9] rounded-lg overflow-hidden bg-neutral-100">
        <Image
          src={block.image_url}
          alt={block.alt}
          fill
          sizes={`(max-width: 768px) 100vw, ${maxWidth}px`}
          priority={priority}
          className="object-cover"
        />
      </div>
      {block.caption && (
        <figcaption className="mt-2 text-center text-xs text-neutral-500">{block.caption}</figcaption>
      )}
    </figure>
  );
  return (
    <section className="px-4 sm:px-6">
      {block.link_url ? <Link href={block.link_url}>{content}</Link> : content}
    </section>
  );
}

function CtaBlock({ block }: { block: Extract<PageBlock, { type: 'cta' }> }) {
  if (!block.label || !block.link_url) return null;
  const align = block.align ?? 'center';
  const style = block.style ?? 'primary';
  const justify = align === 'center' ? 'justify-center' : align === 'right' ? 'justify-end' : 'justify-start';
  const buttonClass =
    style === 'primary'
      ? 'bg-brand-ink text-white hover:bg-black'
      : 'bg-white text-brand-ink border border-neutral-200 hover:bg-neutral-50';
  return (
    <section className={`flex ${justify} px-4 sm:px-6`}>
      <Link
        href={block.link_url}
        className={`inline-flex items-center gap-2 px-8 py-4 text-[13px] font-bold tracking-wider transition-colors ${buttonClass}`}
      >
        {block.label}
      </Link>
    </section>
  );
}

function EmbedBlock({ block }: { block: Extract<PageBlock, { type: 'embed' }> }) {
  if (!block.url) return null;
  const aspect = block.aspect ?? '16/9';
  const aspectClass = aspect === '4/3' ? 'aspect-[4/3]' : aspect === '1/1' ? 'aspect-square' : 'aspect-video';
  return (
    <section className="max-w-4xl mx-auto px-4 sm:px-6">
      <div className={`relative w-full ${aspectClass} rounded-lg overflow-hidden bg-black`}>
        <iframe
          src={block.url}
          className="absolute inset-0 w-full h-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
          title="Embedded media"
        />
      </div>
    </section>
  );
}
