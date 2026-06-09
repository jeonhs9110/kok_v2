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
  /**
   * In all consumers (HeroSlider / SubHeroBanner / CarouselSlidePreview)
   * the container is `flex flex-col`, so `justify-*` aligns on the MAIN
   * axis (vertical) and `items-*` aligns on the CROSS axis (horizontal).
   * The earlier table had these flipped and 5 of the 9 positions
   * rendered to the wrong cell — fixed 2026-06-09.
   */
  justify: 'justify-start' | 'justify-center' | 'justify-end';
  align: 'items-start' | 'items-center' | 'items-end';
  /** Inline text-align so multi-line titles read sensibly. */
  textAlign: 'text-left' | 'text-center' | 'text-right';
}

export const POSITION_OPTIONS: PositionOption[] = [
  { key: 'tl', justify: 'justify-start',  align: 'items-start',  textAlign: 'text-left'   },
  { key: 'tc', justify: 'justify-start',  align: 'items-center', textAlign: 'text-center' },
  { key: 'tr', justify: 'justify-start',  align: 'items-end',    textAlign: 'text-right'  },
  { key: 'ml', justify: 'justify-center', align: 'items-start',  textAlign: 'text-left'   },
  { key: 'mc', justify: 'justify-center', align: 'items-center', textAlign: 'text-center' },
  { key: 'mr', justify: 'justify-center', align: 'items-end',    textAlign: 'text-right'  },
  { key: 'bl', justify: 'justify-end',    align: 'items-start',  textAlign: 'text-left'   },
  { key: 'bc', justify: 'justify-end',    align: 'items-center', textAlign: 'text-center' },
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

/**
 * sm:-prefixed lookup for the *desktop* breakpoint when a section uses
 * separate mobile + desktop anchors (carousel migration 27 added
 * text_position_mobile alongside the existing text_position desktop
 * column). Written as literal class strings so Tailwind's JIT pickup
 * sees every `sm:items-*`, `sm:justify-*`, `sm:text-*` it needs to
 * generate — building these by string-concatenation at runtime would
 * have Tailwind purge them as undetected.
 */
export const POSITION_DESKTOP_SM: Record<PositionKey, {
  align: 'sm:items-start' | 'sm:items-center' | 'sm:items-end';
  justify: 'sm:justify-start' | 'sm:justify-center' | 'sm:justify-end';
  textAlign: 'sm:text-left' | 'sm:text-center' | 'sm:text-right';
}> = {
  // Same flex-col axis correction as POSITION_OPTIONS above.
  tl: { align: 'sm:items-start',  justify: 'sm:justify-start',  textAlign: 'sm:text-left'   },
  tc: { align: 'sm:items-center', justify: 'sm:justify-start',  textAlign: 'sm:text-center' },
  tr: { align: 'sm:items-end',    justify: 'sm:justify-start',  textAlign: 'sm:text-right'  },
  ml: { align: 'sm:items-start',  justify: 'sm:justify-center', textAlign: 'sm:text-left'   },
  mc: { align: 'sm:items-center', justify: 'sm:justify-center', textAlign: 'sm:text-center' },
  mr: { align: 'sm:items-end',    justify: 'sm:justify-center', textAlign: 'sm:text-right'  },
  bl: { align: 'sm:items-start',  justify: 'sm:justify-end',    textAlign: 'sm:text-left'   },
  bc: { align: 'sm:items-center', justify: 'sm:justify-end',    textAlign: 'sm:text-center' },
  br: { align: 'sm:items-end',    justify: 'sm:justify-end',    textAlign: 'sm:text-right'  },
};

export function positionDesktopForKey(key: string | null | undefined) {
  if (!key) return POSITION_DESKTOP_SM.mc;
  return POSITION_DESKTOP_SM[key as PositionKey] ?? POSITION_DESKTOP_SM.mc;
}

/**
 * md:-prefixed lookup, same idea as POSITION_DESKTOP_SM but for sections
 * whose desktop layout kicks in at the md (768px) breakpoint. SubHero
 * uses md: throughout (`text-3xl md:text-5xl`); routing its desktop
 * anchor through this map matches the rest of its responsive utilities.
 */
export const POSITION_DESKTOP_MD: Record<PositionKey, {
  align: 'md:items-start' | 'md:items-center' | 'md:items-end';
  justify: 'md:justify-start' | 'md:justify-center' | 'md:justify-end';
  textAlign: 'md:text-left' | 'md:text-center' | 'md:text-right';
}> = {
  // Same flex-col axis correction as POSITION_OPTIONS above.
  tl: { align: 'md:items-start',  justify: 'md:justify-start',  textAlign: 'md:text-left'   },
  tc: { align: 'md:items-center', justify: 'md:justify-start',  textAlign: 'md:text-center' },
  tr: { align: 'md:items-end',    justify: 'md:justify-start',  textAlign: 'md:text-right'  },
  ml: { align: 'md:items-start',  justify: 'md:justify-center', textAlign: 'md:text-left'   },
  mc: { align: 'md:items-center', justify: 'md:justify-center', textAlign: 'md:text-center' },
  mr: { align: 'md:items-end',    justify: 'md:justify-center', textAlign: 'md:text-right'  },
  bl: { align: 'md:items-start',  justify: 'md:justify-end',    textAlign: 'md:text-left'   },
  bc: { align: 'md:items-center', justify: 'md:justify-end',    textAlign: 'md:text-center' },
  br: { align: 'md:items-end',    justify: 'md:justify-end',    textAlign: 'md:text-right'  },
};

export function positionDesktopMdForKey(key: string | null | undefined) {
  if (!key) return POSITION_DESKTOP_MD.mc;
  return POSITION_DESKTOP_MD[key as PositionKey] ?? POSITION_DESKTOP_MD.mc;
}

/**
 * Map a 9-cell anchor key to the corresponding CSS `object-position`
 * value. Used by HeroSlider + CarouselSlidePreview to honor
 * carousel_slides.image_position / image_position_mobile (migration 29).
 *
 * 'tl' → 'left top', 'tc' → 'center top', 'tr' → 'right top'
 * 'ml' → 'left center', 'mc' → 'center', 'mr' → 'right center'
 * 'bl' → 'left bottom', 'bc' → 'center bottom', 'br' → 'right bottom'
 */
const OBJECT_POSITION_BY_KEY: Record<PositionKey, string> = {
  // Center-of-cell percentages, matching the updated ANCHOR_BY_KEY
  // and the snap presets in ContinuousPositionPicker (2026-06-10).
  tl: '17% 17%',  tc: '50% 17%',  tr: '83% 17%',
  ml: '17% 50%',  mc: '50% 50%',  mr: '83% 50%',
  bl: '17% 83%',  bc: '50% 83%',  br: '83% 83%',
};

export function objectPositionForKey(key: string | null | undefined): string {
  if (!key) return OBJECT_POSITION_BY_KEY.mc;
  return OBJECT_POSITION_BY_KEY[key as PositionKey] ?? OBJECT_POSITION_BY_KEY.mc;
}

/* ──────────────────────────────────────────────────────────
   Continuous position anchors (migration 30, 2026-06-09)

   Replaces the 9-cell PositionKey with a continuous (x, y)
   percentage. Stored as JSONB in *_anchor columns; admin picks
   any point in a live preview, render places the text block /
   object-position there. The 9-cell helpers above are kept so
   storefront code can read both new and legacy rows without a
   second migration pass.
   ────────────────────────────────────────────────────────── */

/** Percent anchor — both x and y are 0..100, top-left origin. */
export interface PositionAnchor {
  x: number;
  y: number;
}

/** Cell-to-anchor map used when backfill is missing and we have a
 *  legacy 9-cell key. Each cell points at the CENTER of its grid
 *  third (≈ 16.67 / 50 / 83.33 %), matching the snap presets in
 *  ContinuousPositionPicker — both updated 2026-06-10 per 송이's
 *  feedback that edge-pinning didn't match what the visual grid
 *  implied. Legacy banners saved with these keys will shift by ~17%
 *  on first render, then stay put once the new anchor is saved. */
const ANCHOR_BY_KEY: Record<PositionKey, PositionAnchor> = {
  tl: { x: 17, y: 17 }, tc: { x: 50, y: 17 }, tr: { x: 83, y: 17 },
  ml: { x: 17, y: 50 }, mc: { x: 50, y: 50 }, mr: { x: 83, y: 50 },
  bl: { x: 17, y: 83 }, bc: { x: 50, y: 83 }, br: { x: 83, y: 83 },
};

/**
 * Resolve the on-render anchor. Order of precedence:
 *   1. explicit JSONB anchor from the new *_anchor column (preferred)
 *   2. derived from the legacy 9-cell key column
 *   3. center (50, 50) fallback
 *
 * Accepts whatever Supabase hands back — JSONB rides through as a plain
 * object, but unsanitized rows may still be strings, so we cope with both.
 */
export function resolveAnchor(
  jsonAnchor: unknown,
  legacyKey: string | null | undefined,
): PositionAnchor {
  // 1. New column wins when populated.
  const parsed = parseAnchorValue(jsonAnchor);
  if (parsed) return parsed;
  // 2. Fall back to the 9-cell key the row was saved with before migration 30.
  if (legacyKey && (legacyKey in ANCHOR_BY_KEY)) {
    return ANCHOR_BY_KEY[legacyKey as PositionKey];
  }
  // 3. No signal at all — center.
  return { x: 50, y: 50 };
}

function parseAnchorValue(raw: unknown): PositionAnchor | null {
  if (!raw) return null;
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return null; }
  }
  if (typeof obj !== 'object' || obj === null) return null;
  const { x, y } = obj as { x?: unknown; y?: unknown };
  if (typeof x !== 'number' || typeof y !== 'number') return null;
  return { x: clamp(x), y: clamp(y) };
}

function clamp(n: number): number {
  if (!Number.isFinite(n)) return 50;
  if (n < 0) return 0;
  if (n > 100) return 100;
  return n;
}

/**
 * CSS `object-position` value for an image focal anchor. Drives the
 * <img> / <video> object-position so the focal point stays in view
 * when the slide is letterboxed / pillarboxed.
 */
export function anchorToObjectPosition(anchor: PositionAnchor): string {
  return `${anchor.x}% ${anchor.y}%`;
}

/**
 * Inline styles for the text block. Uses edge-aware anchoring:
 *
 *   - x ≤ 25%  → pin to the left edge with a 4% margin, text-align: left
 *   - x ≥ 75%  → pin to the right edge with a 4% margin, text-align: right
 *   - 25–75%   → center horizontally around x via translateX(-50%),
 *                text-align: center
 *
 * Vertical axis follows the same edge-aware shape. Without this the
 * marker dropped at (0, 0) would translate(-50%, -50%) off-screen and
 * the title would be invisible. With it, clicking any corner lands the
 * text block snug in that corner, and any interior point centers
 * cleanly around the anchor.
 */
export function anchorTextStyle(anchor: PositionAnchor): React.CSSProperties {
  const style: React.CSSProperties = {
    position: 'absolute',
    maxWidth: '85%',
  };
  const transforms: string[] = [];

  // Horizontal
  if (anchor.x <= 25) {
    style.left = `${Math.max(anchor.x, 4)}%`;
    style.textAlign = 'left';
  } else if (anchor.x >= 75) {
    style.right = `${Math.max(100 - anchor.x, 4)}%`;
    style.textAlign = 'right';
  } else {
    style.left = `${anchor.x}%`;
    transforms.push('translateX(-50%)');
    style.textAlign = 'center';
  }

  // Vertical
  if (anchor.y <= 25) {
    style.top = `${Math.max(anchor.y, 4)}%`;
  } else if (anchor.y >= 75) {
    style.bottom = `${Math.max(100 - anchor.y, 4)}%`;
  } else {
    style.top = `${anchor.y}%`;
    transforms.push('translateY(-50%)');
  }

  if (transforms.length) style.transform = transforms.join(' ');
  return style;
}
