/**
 * Page builder block schema — shared between the /admin/pages editor and the
 * public /[lang]/pages/[slug] renderer.
 *
 * Lives in src/lib/ (not src/app/admin/pages/_lib.ts) because the public
 * page route also needs to import these types to render saved blocks.
 *
 * Storage model:
 *
 *   pages.blocks JSONB column holds a per-language map:
 *     { kr: PageBlock[], en: PageBlock[] }
 *
 *   Legacy rows that predate the builder may still have only `content`
 *   (the old plain rich-text field). The renderer falls back to that
 *   when `blocks` is null/empty for the requested language.
 */

export type BlockType = 'hero' | 'text' | 'image' | 'cta' | 'embed';

export interface BlockHero {
  type: 'hero';
  title: string;
  subtitle: string;
  image_url: string;
  /** Optional CTA on the hero — both fields required to render the button */
  cta_text?: string;
  cta_link?: string;
  bg_color?: string;
  text_color?: string;
  /** Layout: `image-right` = text left + image right; `fullbleed` = bg image with text overlay */
  layout?: 'image-right' | 'fullbleed';
}

export interface BlockText {
  type: 'text';
  /** Rich-text HTML produced by the TipTap editor */
  html: string;
}

export interface BlockImage {
  type: 'image';
  image_url: string;
  alt: string;
  caption?: string;
  link_url?: string;
  /** Max width in pixels. Defaults to 1200 (the storefront container). */
  max_width?: number;
}

export interface BlockCta {
  type: 'cta';
  label: string;
  link_url: string;
  align?: 'left' | 'center' | 'right';
  style?: 'primary' | 'secondary';
}

export interface BlockEmbed {
  type: 'embed';
  /** Auto-detected from URL on save (youtube → embed URL, etc.) */
  embed_kind: 'youtube' | 'vimeo' | 'iframe';
  /** Full embed URL (e.g. https://www.youtube.com/embed/VIDEO_ID) */
  url: string;
  aspect?: '16/9' | '4/3' | '1/1';
}

export type PageBlock = BlockHero | BlockText | BlockImage | BlockCta | BlockEmbed;

/** Per-language block list. */
export type PageBlocks = Partial<Record<string, PageBlock[]>>;

export const BLOCK_LABELS: Record<BlockType, string> = {
  hero: '히어로',
  text: '텍스트',
  image: '이미지',
  cta: '버튼 (CTA)',
  embed: '동영상 / 임베드',
};

export function makeBlock(type: BlockType): PageBlock {
  switch (type) {
    case 'hero':
      return {
        type: 'hero',
        title: '',
        subtitle: '',
        image_url: '',
        cta_text: '',
        cta_link: '',
        bg_color: '#f5f5f5',
        // Empty so the renderer's layout-aware fallback wins by default:
        //   - fullbleed → '#ffffff' (white on photo overlay)
        //   - image-right → '#111' (dark on light card)
        // Operator can still pick a custom value via the ColorRow control;
        // see [src/app/admin/pages/_components/BlockEditors/HeroBlockEditor.tsx].
        // Without this, fullbleed shipped unreadable dark titles on photo
        // backgrounds the first time an operator picked the fullbleed
        // layout without manually opening the color picker.
        text_color: '',
        layout: 'image-right',
      };
    case 'text':
      return { type: 'text', html: '' };
    case 'image':
      return { type: 'image', image_url: '', alt: '', caption: '', link_url: '', max_width: 1200 };
    case 'cta':
      return { type: 'cta', label: '', link_url: '', align: 'center', style: 'primary' };
    case 'embed':
      return { type: 'embed', embed_kind: 'youtube', url: '', aspect: '16/9' };
  }
}

/**
 * Convert a raw YouTube watch URL (or share URL, or shorts URL) into the
 * canonical embed URL that an iframe can load. Returns the input untouched
 * if it can't be parsed.
 */
export function normalizeEmbedUrl(raw: string, kind: BlockEmbed['embed_kind']): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (kind === 'youtube') {
    const match =
      trimmed.match(/(?:youtu\.be\/|v=|shorts\/|embed\/)([A-Za-z0-9_-]{11})/);
    if (match) return `https://www.youtube.com/embed/${match[1]}`;
  }
  if (kind === 'vimeo') {
    const match = trimmed.match(/vimeo\.com\/(?:video\/)?(\d+)/);
    if (match) return `https://player.vimeo.com/video/${match[1]}`;
  }
  return trimmed;
}
