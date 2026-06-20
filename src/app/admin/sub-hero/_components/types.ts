import type { PositionAnchor, PositionKey } from '@/lib/typography/options';

/**
 * Banner row shape — single source of truth for the sub-hero editor +
 * its extracted children. Migrations 24 / 28 / 30 / 31 added the
 * typography + per-breakpoint anchor columns; the canonical fallbacks
 * live in EMPTY in the parent page.
 */
export interface SubHero {
  id: string | null;
  image_url: string;
  link_url: string;
  title: string;
  subtitle: string;
  title_size_offset: number;
  subtitle_size_offset: number;
  is_active: boolean;
  title_font_family: string | null;
  subtitle_font_family: string | null;
  title_bold: boolean;
  title_italic: boolean;
  title_underline: boolean;
  subtitle_bold: boolean;
  subtitle_italic: boolean;
  subtitle_underline: boolean;
  title_color: string | null;
  subtitle_color: string | null;
  text_position: PositionKey;
  text_position_mobile: PositionKey;
  text_anchor: PositionAnchor;
  text_anchor_mobile: PositionAnchor;
  image_anchor: PositionAnchor;
  image_anchor_mobile: PositionAnchor;
}
