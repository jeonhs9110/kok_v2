import { makeAdminTableRoute } from '@/lib/admin/tableRoute';

const route = makeAdminTableRoute({
  table: 'categories',
  orderBy: 'sort_order',
  direction: 'ASC',
  required: ['slug'],
  insertDefaults: { is_active: true },
  allowedColumns: [
    'parent_id', 'slug', 'name',
    'sort_order', 'is_active',
  ],
});

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
