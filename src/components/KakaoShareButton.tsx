'use client';

import { useState } from 'react';

interface Props {
  /** Fully-qualified URL to share (product/post/etc). Auto-derived to
   *  window.location if omitted so this component works as a generic
   *  "share this page" button. */
  url?: string;
  /** Preview title Kakao renders in the share card. Falls back to the
   *  page's <title> tag when omitted. */
  title?: string;
  /** Preview description Kakao renders under the title. Optional but
   *  strongly recommended — Kakao's default fallback is ugly. */
  description?: string;
  /** Preview thumbnail Kakao renders on the share card. Should be at
   *  least 200×200 px per Kakao's guidelines; product hero images
   *  work perfectly. */
  imageUrl?: string;
  /** UI language for the button label. Falls back to Korean if unset,
   *  since the button is a Korean-market-first surface. */
  lang?: string;
  /** Optional className passthrough for the wrapping button. */
  className?: string;
}

/**
 * Deep-link sharer to KakaoTalk — Korea's dominant messaging app.
 * Uses the URL-based `https://sharer.kakao.com/talk/friends/picker/link`
 * endpoint so we don't have to ship the Kakao JS SDK (~40KB) or store
 * an App Key. Trade-off: the share card doesn't get the full custom
 * template features (buttons, structured items) — we only pass URL +
 * title + description + image, which Kakao pulls into a standard
 * "link preview" card. For 95% of the "customer wants to send this
 * product to a KakaoTalk friend" use case, that's enough.
 *
 * When the customer taps this button on iOS/Android where KakaoTalk
 * is installed, the OS opens the share sheet directly. On desktop the
 * sharer.kakao.com URL opens a friend-picker in a new tab.
 *
 * Falls back to native `navigator.share` on non-Korean visitors (or
 * browsers where KakaoTalk isn't installed) so the button doesn't
 * dead-end.
 */
export default function KakaoShareButton({
  url,
  title,
  description,
  imageUrl,
  lang = 'kr',
  className,
}: Props) {
  const [copied, setCopied] = useState(false);
  const isKr = lang === 'kr';
  const label = isKr ? '카카오톡 공유' : 'Share on KakaoTalk';

  const resolveUrl = (): string => {
    if (url) return url;
    if (typeof window !== 'undefined') return window.location.href;
    return '';
  };

  const handleShare = async () => {
    const shareUrl = resolveUrl();
    if (!shareUrl) return;

    // Try native share sheet first — best UX on mobile, and includes
    // KakaoTalk automatically if it's installed. iOS/Android both
    // expose this on modern browsers.
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try {
        await navigator.share({
          title: title ?? document.title,
          text: description,
          url: shareUrl,
        });
        return;
      } catch {
        // User cancelled or share failed. Fall through to Kakao URL.
      }
    }

    // Kakao's URL-based sharer. Opens a friend-picker + preview card
    // populated from the target URL's OG tags (which the site already
    // emits comprehensively — see [lang]/products/[id]/page.tsx
    // generateMetadata). Query params are optional metadata Kakao
    // uses when the target URL isn't yet crawled by their scraper.
    const params = new URLSearchParams();
    params.set('url', shareUrl);
    if (title) params.set('title', title);
    if (description) params.set('description', description);
    if (imageUrl) params.set('image', imageUrl);
    const sharerUrl = `https://sharer.kakao.com/talk/friends/picker/link?${params.toString()}`;

    // Final fallback: if the popup is blocked, copy the URL to
    // clipboard so the customer can at least paste it into
    // KakaoTalk themselves.
    const opened = window.open(sharerUrl, '_blank', 'noopener,noreferrer,width=480,height=640');
    if (!opened) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch { /* clipboard blocked too — nothing more we can do */ }
    }
  };

  return (
    <button
      type="button"
      onClick={handleShare}
      aria-label={label}
      className={
        className ??
        'inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-brand-ink border border-neutral-200 rounded hover:bg-[#FEE500] hover:border-[#FEE500] transition-colors min-h-[40px]'
      }
    >
      {/* KakaoTalk logo — inline SVG so we don't pull in the SDK. */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        width="16"
        height="16"
        fill="currentColor"
      >
        <path d="M12 3C6.48 3 2 6.54 2 10.9c0 2.82 1.85 5.3 4.66 6.72l-1.14 4.13c-.1.37.3.66.62.44l4.86-3.15c.32.02.65.03.98.03 5.52 0 10-3.54 10-7.9 0-4.36-4.48-7.9-10-7.9z" />
      </svg>
      {copied ? (isKr ? '주소 복사됨' : 'Link copied') : label}
    </button>
  );
}
