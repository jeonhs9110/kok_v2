import { makeAdminTableRoute } from '@/lib/admin/tableRoute';

const route = makeAdminTableRoute({
  table: 'shorts',
  orderBy: 'created_at',
  direction: 'DESC',
  required: ['youtube_id'],
  hasIsActive: false, // shorts has no is_active column
  allowedColumns: ['youtube_id', 'product_id'],
});

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
