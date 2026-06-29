import { makeAdminTableRoute } from '@/lib/admin/tableRoute';

// 2026-06-29: added the four anchor columns to allowedColumns. The
// useSubHero payload sends `text_anchor`, `text_anchor_mobile`,
// `image_anchor`, and `image_anchor_mobile` (migrations 30 + 31 —
// continuous (x, y) percent anchors for the text marker and image
// focal point). The generic admin-table route's `pickAllowed` filter
// silently dropped all four on every save. Symptoms: operator drags
// the text marker to a specific (x, y) on the live preview, hits
// Save, reload → marker snaps back to center. Same on the public
// storefront — the SubHeroBanner.tsx resolveAnchor() fallback ran
// against NULL anchors and dropped to the legacy 9-cell
// text_position. The precise drag-positioning feature has been
// effectively offline since the table-route migration.
const route = makeAdminTableRoute({
  table: 'sub_hero_banners',
  orderBy: 'created_at',
  direction: 'DESC',
  insertDefaults: { is_active: true },
  allowedColumns: [
    'image_url', 'link_url',
    'title', 'subtitle',
    'title_size_offset', 'subtitle_size_offset',
    'title_font_family', 'subtitle_font_family',
    'title_bold', 'title_italic', 'title_underline',
    'subtitle_bold', 'subtitle_italic', 'subtitle_underline',
    'title_color', 'subtitle_color',
    'text_position', 'text_position_mobile',
    'text_anchor', 'text_anchor_mobile',
    'image_anchor', 'image_anchor_mobile',
    'is_active',
  ],
});

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
