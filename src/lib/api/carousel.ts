import { supabase } from './products';

export interface CarouselSlide {
  id: string;
  badge: Record<string, string>;
  title: Record<string, string>;
  subtitle: Record<string, string>;
  image_url: string | null;
  /** Migration 35 — optional mobile-specific hero image. NULL falls
   *  back to image_url. HeroSlider swaps via the sm breakpoint. */
  mobile_image_url?: string | null;
  bg_color: string;
  text_color?: string;
  badge_bg_color?: string;
  badge_text_color?: string;
  title_size_offset?: number;
  subtitle_size_offset?: number;
  badge_size_offset?: number;
  sort_order: number;
  is_active: boolean;
  link_url: string | null;
  display_mode: 'default' | 'fullpage';
  media_type: 'image' | 'video' | 'gif';
  created_at: string;
  // Phase 3 typography columns (migration 00000000000025). All optional
  // so rows from before the migration still type-check.
  badge_font_family?: string | null;
  title_font_family?: string | null;
  subtitle_font_family?: string | null;
  badge_bold?: boolean | null;
  badge_italic?: boolean | null;
  badge_underline?: boolean | null;
  title_bold?: boolean | null;
  title_italic?: boolean | null;
  title_underline?: boolean | null;
  subtitle_bold?: boolean | null;
  subtitle_italic?: boolean | null;
  subtitle_underline?: boolean | null;
  text_position?: string | null;
  // Migration 27: separate anchor for the mobile breakpoint.
  text_position_mobile?: string | null;
  // Migration 29: per-breakpoint image focal point.
  image_position?: string | null;
  image_position_mobile?: string | null;
  // Migration 30: continuous (x, y) anchors replacing the 9-cell pickers.
  // Stored as JSONB { x: 0-100, y: 0-100 }. Code reads via resolveAnchor()
  // which prefers the new column when populated and falls back to the
  // legacy *_position key on older rows.
  text_anchor?: unknown;
  text_anchor_mobile?: unknown;
  image_anchor?: unknown;
  image_anchor_mobile?: unknown;
}

export async function getActiveSlides(): Promise<CarouselSlide[]> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getActiveSlidesFromPg } = await import('@/lib/db/storefront-reads');
      return (await getActiveSlidesFromPg()) as unknown as CarouselSlide[];
    } catch (err) {
      console.error('[carousel] RDS getActiveSlides failed:', err);
      return [];
    }
  }
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('carousel_slides')
    .select('*')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data;
}

export async function getAllSlides(): Promise<CarouselSlide[]> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getAllSlidesFromPg } = await import('@/lib/db/storefront-reads');
      return (await getAllSlidesFromPg()) as unknown as CarouselSlide[];
    } catch (err) {
      console.error('[carousel] RDS getAllSlides failed:', err);
      return [];
    }
  }
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('carousel_slides')
    .select('*')
    .order('sort_order', { ascending: true });
  if (error || !data) return [];
  return data;
}
