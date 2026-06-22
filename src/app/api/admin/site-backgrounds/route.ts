import { makeAdminTableRoute } from '@/lib/admin/tableRoute';

const route = makeAdminTableRoute({
  table: 'site_backgrounds',
  orderBy: 'created_at',
  direction: 'DESC',
  required: ['file_url', 'file_type'],
  insertDefaults: { is_active: false },
  allowedColumns: [
    'file_url', 'file_type', 'scroll_driven',
    'is_active', 'sort_order',
  ],
});

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
