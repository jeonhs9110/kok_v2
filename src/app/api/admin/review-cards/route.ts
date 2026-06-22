import { makeAdminTableRoute } from '@/lib/admin/tableRoute';

const route = makeAdminTableRoute({
  table: 'review_cards',
  orderBy: 'sort_order',
  direction: 'ASC',
  insertDefaults: { is_active: true },
  allowedColumns: [
    'image_url', 'title', 'content_html', 'link_url',
    'sort_order', 'is_active',
  ],
});

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
