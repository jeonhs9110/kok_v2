import { makeAdminTableRoute } from '@/lib/admin/tableRoute';

const route = makeAdminTableRoute({
  table: 'carousel_slides',
  orderBy: 'sort_order',
  direction: 'ASC',
  insertDefaults: { is_active: true },
  // Mirror the columns useSlideForm/_lib.ts buildSlidePayload writes.
  // When a new typography or position column gets added, append it here
  // AND in the supabase fallback in _lib.ts — silent column drop is the
  // failure mode.
  allowedColumns: [
    'badge', 'title', 'subtitle',
    'image_url', 'mobile_image_url',
    'bg_color', 'text_color', 'badge_bg_color', 'badge_text_color',
    'title_size_offset', 'subtitle_size_offset', 'badge_size_offset',
    'sort_order', 'is_active', 'link_url',
    'display_mode', 'media_type',
    'badge_font_family', 'title_font_family', 'subtitle_font_family',
    'badge_bold', 'badge_italic', 'badge_underline',
    'title_bold', 'title_italic', 'title_underline',
    'subtitle_bold', 'subtitle_italic', 'subtitle_underline',
    'text_position', 'text_position_mobile',
    'image_position', 'image_position_mobile',
    'text_anchor', 'text_anchor_mobile',
    'image_anchor', 'image_anchor_mobile',
  ],
});

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
