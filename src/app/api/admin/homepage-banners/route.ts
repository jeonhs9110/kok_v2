import { makeAdminTableRoute } from '@/lib/admin/tableRoute';

const route = makeAdminTableRoute({
  table: 'homepage_banners',
  orderBy: 'created_at',
  direction: 'DESC',
  insertDefaults: { is_active: true },
  allowedColumns: [
    'text', 'link_url',
    'bg_color', 'text_color',
    'is_active',
  ],
});

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
