import SectionBackground, { type SectionBackgroundConfig } from '@/components/SectionBackground';

export interface InstagramPost {
  id: string;
  image_url: string;
  link_url: string;
  post_url?: string;
  sort_order: number;
}

function extractPostId(url: string): string | null {
  const match = url.match(/instagram\.com\/(?:p|reel|tv)\/([^/?#]+)/i);
  return match ? match[1] : null;
}

export interface InstagramData {
  handle: string;
  description: string;
  posts: InstagramPost[];
  // Admin-configured section background (migration 26). Null when the
  // admin hasn't touched it — caller falls back to the legacy look.
  bg_type?: string | null;
  bg_color?: string | null;
  bg_media_url?: string | null;
  bg_media_type?: string | null;
  // Migration 34 — header (@handle) style. NULL falls back to text-lg /
  // neutral-800 / no plate.
  header_font_size?: string | null;
  header_text_color?: string | null;
  header_bg_color?: string | null;
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
  // If the DB doesn't have an instagram_config row (or the fetch failed),
  // hide the whole section instead of falling back to a hardcoded handle.
  // The previous default '@rdrd_official' is an outdated/wrong handle that
  // would route users to the wrong account and hide the real failure.
  if (!data?.handle) return null;
  const handle = data.handle;
  const description = data.description || '';
  const posts = data.posts || [];
  const profileUrl = `https://www.instagram.com/${handle}/`;

  // Build 6 slots — filled posts first, then empty placeholders
  const slots = Array.from({ length: SLOTS }, (_, i) => posts[i] || null);

  const bgConfig: SectionBackgroundConfig = {
    type: data.bg_type ?? null,
    color: data.bg_color ?? null,
    media_url: data.bg_media_url ?? null,
    media_type: data.bg_media_type ?? null,
  };
  return (
    <SectionBackground
      config={bgConfig}
      className="py-16 md:py-24"
      fallbackClassName=""
    >
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="flex flex-col items-center mb-10">
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 transition-colors group hover:text-[#E1306C]"
            style={{
              color: data.header_text_color ?? '#262626', // ~ neutral-800
              backgroundColor: data.header_bg_color ?? undefined,
              padding: data.header_bg_color ? '0.5rem 1rem' : undefined,
              borderRadius: data.header_bg_color ? '0.375rem' : undefined,
            }}
          >
            <IgIcon className="w-6 h-6 group-hover:scale-110 transition-transform" />
            <span
              className="font-bold tracking-wide"
              style={{ fontSize: data.header_font_size ?? '18px' }}
            >
              @{handle}
            </span>
          </a>
          <p className="mt-2 text-sm text-neutral-400">{description}</p>
        </div>

        {/* Feed grid — 6 slots; if any post has post_url, use 2-3 col layout for embed height */}
        {(() => {
          const hasAnyEmbed = posts.some(p => p.post_url && extractPostId(p.post_url));
          const gridClass = hasAnyEmbed
            ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4'
            : 'grid grid-cols-3 md:grid-cols-6 gap-1.5';

          return (
            <div className={gridClass}>
              {slots.map((post, i) => {
                const postId = post?.post_url ? extractPostId(post.post_url) : null;

                // Option 1: Instagram official embed iframe
                if (postId) {
                  return (
                    <div key={i} className="bg-white border border-neutral-200 rounded-lg overflow-hidden">
                      <iframe
                        src={`https://www.instagram.com/p/${postId}/embed/`}
                        scrolling="no"
                        className="w-full"
                        style={{ border: 'none', overflow: 'hidden', minHeight: '480px' }}
                        loading="lazy"
                      />
                    </div>
                  );
                }

                // Option 2: Manual uploaded image (fallback)
                const href = post?.link_url || profileUrl;
                return (
                  <a
                    key={i}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${hasAnyEmbed ? 'aspect-[4/5]' : 'aspect-square'} block overflow-hidden group relative bg-neutral-100`}
                  >
                    {post?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={post.image_url}
                        alt={`@${handle} Instagram post`}
                        width={600}
                        height={600}
                        loading="lazy"
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
          );
        })()}

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
    </SectionBackground>
  );
}
