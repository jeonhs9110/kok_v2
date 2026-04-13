'use client';

export interface InstagramPost {
  id: string;
  image_url: string;
  link_url: string;
  sort_order: number;
}

export interface InstagramData {
  handle: string;
  description: string;
  posts: InstagramPost[];
  widget_url?: string;
}

interface Props {
  data?: InstagramData | null;
}

function IgIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

const SLOTS = 6;

export default function InstagramSection({ data }: Props) {
  const handle = data?.handle || 'rdrd_official';
  const description = data?.description || '인스타그램에서 최신 소식을 확인하세요';
  const posts = data?.posts || [];
  const widgetUrl = data?.widget_url;
  const profileUrl = `https://www.instagram.com/${handle}/`;

  // Build 6 slots — filled posts first, then empty placeholders
  const slots = Array.from({ length: SLOTS }, (_, i) => posts[i] || null);

  return (
    <section className="py-16 md:py-24 bg-white">
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-neutral-800 hover:text-[#E1306C] transition-colors group"
          >
            <IgIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span className="text-lg font-bold tracking-wide">@{handle}</span>
          </a>
          <p className="mt-2 text-sm text-neutral-400">{description}</p>
        </div>

        {/* Live widget (if widget_url set) OR manual feed grid */}
        {widgetUrl ? (
          <div className="w-full">
            <iframe
              src={widgetUrl}
              scrolling="no"
              allowTransparency
              className="w-full border-0 overflow-hidden"
              style={{ width: '100%', border: 0, overflow: 'hidden', minHeight: '400px' }}
              height={500}
              loading="lazy"
            />
          </div>
        ) : (
          <div className="grid grid-cols-3 md:grid-cols-6 gap-1.5">
            {slots.map((post, i) => {
              const href = post?.link_url || profileUrl;
              return (
                <a
                  key={i}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="aspect-square block overflow-hidden group relative bg-neutral-100"
                >
                  {post?.image_url ? (
                    <img
                      src={post.image_url}
                      alt=""
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-[1.05]"
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-100" />
                  )}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors duration-300 flex items-center justify-center">
                    <IgIcon className="w-7 h-7 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                </a>
              );
            })}
          </div>
        )}

        {/* CTA */}
        <div className="flex justify-center mt-8">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 border border-neutral-300 text-neutral-800 hover:border-neutral-800 transition-colors px-8 py-3 text-sm font-semibold tracking-widest rounded-full"
          >
            <IgIcon className="w-4 h-4" />
            Instagram에서 더 보기
          </a>
        </div>
      </div>
    </section>
  );
}
