/**
 * Shared typography options for admin "text-over-image" editors
 * (SubHero banner, carousel slides, future image-block fields).
 *
 * Keeping the font list + 9-cell position grid in one module means
 * Phase 2's SubHero panel and Phase 3's carousel panel render the
 * identical dropdown / picker, and any future font addition lands in
 * one place. Both panels also resolve a font key -> CSS family stack
 * through `fontFamilyForKey()` below, so renderers can be schema-driven.
 *
 * Korean fonts come from Google Fonts (loaded once in the root layout
 * via a <link>). English brand fonts come from Adobe Fonts (Tablet
 * Gothic, already on the page) and next/font/local (Freesentation).
 * Adding a new font = one entry here + one extra family on the
 * Google Fonts URL in layout.tsx.
 */

export type FontKey =
  | 'freesentation'      // current Korean brand sans (default)
  | 'tablet-gothic'      // current English brand sans (default)
  | 'pretendard'         // modern Korean web sans, popular for e-commerce
  | 'noto-sans-kr'       // Google Korean sans
  | 'nanum-myeongjo'     // classic Korean serif (heritage tone)
  | 'playfair-display'   // English serif (luxury feel)
  | 'cormorant-garamond' // English elegant serif
  | 'inter';             // neutral English sans

export interface FontOption {
  key: FontKey;
  /** Label shown in the admin dropdown */
  label: string;
  /** Subtitle hint shown under the label */
  hint: string;
  /** CSS font-family stack applied at render time */
  cssFamily: string;
}

export const FONT_OPTIONS: FontOption[] = [
  {
    key: 'freesentation',
    label: '프리젠테이션',
    hint: '브랜드 한글 (기본)',
    cssFamily: 'var(--font-freesentation), -apple-system, BlinkMacSystemFont, sans-serif',
  },
  {
    key: 'tablet-gothic',
    label: 'Tablet Gothic',
    hint: '브랜드 영문 (기본)',
    cssFamily: '"tablet-gothic", "Tablet Gothic", sans-serif',
  },
  {
    key: 'pretendard',
    label: 'Pretendard',
    hint: '모던 한글, 이커머스에 자주 쓰임',
    cssFamily: '"Pretendard", -apple-system, BlinkMacSystemFont, sans-serif',
  },
  {
    key: 'noto-sans-kr',
    label: 'Noto Sans KR',
    hint: 'Google 한글 산세리프',
    cssFamily: '"Noto Sans KR", sans-serif',
  },
  {
    key: 'nanum-myeongjo',
    label: '나눔명조',
    hint: '클래식 한글 명조 (고급스러운 톤)',
    cssFamily: '"Nanum Myeongjo", serif',
  },
  {
    key: 'playfair-display',
    label: 'Playfair Display',
    hint: '영문 세리프, 럭셔리 느낌',
    cssFamily: '"Playfair Display", serif',
  },
  {
    key: 'cormorant-garamond',
    label: 'Cormorant Garamond',
    hint: '영문 우아한 세리프',
    cssFamily: '"Cormorant Garamond", serif',
  },
  {
    key: 'inter',
    label: 'Inter',
    hint: '영문 중립 산세리프',
    cssFamily: '"Inter", sans-serif',
  },
];

const FONT_BY_KEY = new Map<string, FontOption>(FONT_OPTIONS.map(f => [f.key, f]));

/**
 * Resolve a stored font_family key (or null/unknown) to a CSS family
 * stack. Falls back to the brand default so the public site never
 * renders unstyled text when the admin leaves the field blank.
 */
export function fontFamilyForKey(key: string | null | undefined): string {
  if (!key) return FONT_OPTIONS[0].cssFamily;
  return FONT_BY_KEY.get(key)?.cssFamily ?? FONT_OPTIONS[0].cssFamily;
}

// ─── 9-cell Figma-style anchor grid ──────────────────────────────────
// The admin clicks a cell to choose where the text block sits inside
// the image. Each key maps to a Tailwind utility pair (flex alignment
// on the container + text-alignment on the block) so the renderer can
// just spread them into className strings.

export type PositionKey =
  | 'tl' | 'tc' | 'tr'
  | 'ml' | 'mc' | 'mr'
  | 'bl' | 'bc' | 'br';

export interface PositionOption {
  key: PositionKey;
  /** Justify-content along the cross axis (horizontal). */
  justify: 'justify-start' | 'justify-center' | 'justify-end';
  /** Align-items along the main axis (vertical). */
  align: 'items-start' | 'items-center' | 'items-end';
  /** Inline text-align so multi-line titles read sensibly. */
  textAlign: 'text-left' | 'text-center' | 'text-right';
}

export const POSITION_OPTIONS: PositionOption[] = [
  { key: 'tl', justify: 'justify-start',  align: 'items-start',  textAlign: 'text-left'   },
  { key: 'tc', justify: 'justify-center', align: 'items-start',  textAlign: 'text-center' },
  { key: 'tr', justify: 'justify-end',    align: 'items-start',  textAlign: 'text-right'  },
  { key: 'ml', justify: 'justify-start',  align: 'items-center', textAlign: 'text-left'   },
  { key: 'mc', justify: 'justify-center', align: 'items-center', textAlign: 'text-center' },
  { key: 'mr', justify: 'justify-end',    align: 'items-center', textAlign: 'text-right'  },
  { key: 'bl', justify: 'justify-start',  align: 'items-end',    textAlign: 'text-left'   },
  { key: 'bc', justify: 'justify-center', align: 'items-end',    textAlign: 'text-center' },
  { key: 'br', justify: 'justify-end',    align: 'items-end',    textAlign: 'text-right'  },
];

const POSITION_BY_KEY = new Map<string, PositionOption>(POSITION_OPTIONS.map(p => [p.key, p]));

/**
 * Resolve a stored text_position to its container/text alignment
 * classes. Falls back to middle-center (the previous hardcoded
 * SubHeroBanner layout) so a missing column reads as "no change".
 */
export function positionForKey(key: string | null | undefined): PositionOption {
  if (!key) return POSITION_BY_KEY.get('mc')!;
  return POSITION_BY_KEY.get(key) ?? POSITION_BY_KEY.get('mc')!;
}
