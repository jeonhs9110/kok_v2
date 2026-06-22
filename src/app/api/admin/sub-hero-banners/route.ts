import { makeAdminTableRoute } from '@/lib/admin/tableRoute';

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
    'is_active',
  ],
});

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
