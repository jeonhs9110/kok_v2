import { makeAdminTableRoute } from '@/lib/admin/tableRoute';

// 2026-06-29: added `file_name` and `mime_type` to allowedColumns. The
// uploader in useBackgroundManagement.uploadBackground POSTs a payload
// containing both fields (the operator-visible filename + the actual
// MIME type from the file picker). The generic admin-table route's
// `pickAllowed` filter silently drops anything not in this allow-list,
// so every site-background uploaded after the RDS cutover landed with
// NULL file_name + NULL mime_type. The admin background-media library
// then rendered "이 배경" instead of the actual filename, and any
// downstream code reading mime_type lost the source-of-truth signal
// for image-vs-video resolution.
const route = makeAdminTableRoute({
  table: 'site_backgrounds',
  orderBy: 'created_at',
  direction: 'DESC',
  required: ['file_url', 'file_type'],
  insertDefaults: { is_active: false },
  allowedColumns: [
    'file_url', 'file_name', 'file_type', 'mime_type',
    'scroll_driven', 'is_active', 'sort_order',
  ],
});

export const GET = route.GET;
export const POST = route.POST;
export const PATCH = route.PATCH;
export const DELETE = route.DELETE;
