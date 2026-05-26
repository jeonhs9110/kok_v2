export type EmbedPlatform = 'youtube' | 'tiktok' | 'instagram';

export interface EmbedInfo {
  platform: EmbedPlatform;
  id: string;
  embedUrl: string;
  thumbnailUrl: string | null;
  /** Aspect ratio CSS class for the wrapper. */
  aspectClass: string;
  /** Human label for badges. */
  label: string;
  /** Optional sub-label (e.g. "Shorts"). */
  sublabel?: string;
}

const YOUTUBE_RE = /(?:youtube\.com\/watch\?(?:[^&]*&)*v=|youtube\.com\/embed\/|youtube\.com\/shorts\/|youtu\.be\/)([A-Za-z0-9_-]{11})/i;
const YOUTUBE_SHORTS_RE = /youtube\.com\/shorts\//i;

const TIKTOK_LONG_RE = /tiktok\.com\/(?:@[^/]+\/video|embed(?:\/v\d+)?)\/(\d+)/i;
const TIKTOK_SHORT_RE = /(?:vm|vt)\.tiktok\.com\/([A-Za-z0-9]+)/i;

const INSTAGRAM_RE = /instagram\.com\/(?:reel|reels|p|tv)\/([A-Za-z0-9_-]+)/i;
const INSTAGRAM_REEL_RE = /instagram\.com\/(?:reel|reels|tv)\//i;

export function detectEmbed(url: string): EmbedInfo | null {
  if (!url) return null;
  const trimmed = url.trim();

  const yt = trimmed.match(YOUTUBE_RE);
  if (yt) {
    const isShorts = YOUTUBE_SHORTS_RE.test(trimmed);
    return {
      platform: 'youtube',
      id: yt[1],
      embedUrl: `https://www.youtube.com/embed/${yt[1]}`,
      thumbnailUrl: `https://img.youtube.com/vi/${yt[1]}/hqdefault.jpg`,
      aspectClass: isShorts ? 'aspect-[9/16]' : 'aspect-video',
      label: 'YouTube',
      sublabel: isShorts ? 'Shorts' : undefined,
    };
  }

  const ttLong = trimmed.match(TIKTOK_LONG_RE);
  if (ttLong) {
    return {
      platform: 'tiktok',
      id: ttLong[1],
      embedUrl: `https://www.tiktok.com/embed/v2/${ttLong[1]}`,
      thumbnailUrl: null,
      aspectClass: 'aspect-[9/16]',
      label: 'TikTok',
    };
  }
  // Shortlinks (vm.tiktok.com / vt.tiktok.com) can't be resolved client-side
  // without an extra network hop, so we accept them but rely on TikTok's
  // embed page to load the right video from the shortcode itself.
  const ttShort = trimmed.match(TIKTOK_SHORT_RE);
  if (ttShort) {
    return {
      platform: 'tiktok',
      id: ttShort[1],
      embedUrl: `https://www.tiktok.com/embed/v2/${ttShort[1]}`,
      thumbnailUrl: null,
      aspectClass: 'aspect-[9/16]',
      label: 'TikTok',
    };
  }

  const ig = trimmed.match(INSTAGRAM_RE);
  if (ig) {
    const isReel = INSTAGRAM_REEL_RE.test(trimmed);
    return {
      platform: 'instagram',
      id: ig[1],
      embedUrl: `https://www.instagram.com/p/${ig[1]}/embed/`,
      thumbnailUrl: null,
      aspectClass: isReel ? 'aspect-[9/16]' : 'aspect-square',
      label: 'Instagram',
      sublabel: isReel ? 'Reel' : undefined,
    };
  }

  return null;
}

export function isValidEmbedUrl(url: string): boolean {
  return detectEmbed(url) !== null;
}
