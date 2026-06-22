import { makeAdminTableRoute } from '@/lib/admin/tableRoute';

const route = makeAdminTableRoute({
  table: 'instagram_posts',
  orderBy: 'sort_order',
  direction: 'ASC',
  insertDefaults: { is_active: true },
  allowedColumns: [
    'image_url', 'link_url', 'post_url',
    'sort_order', 'is_active',
  ],
});

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
