import { NextResponse } from 'next/server';
import { makeAdminTableRoute } from '@/lib/admin/tableRoute';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { assertSameOrigin } from '@/lib/http/csrf';

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

/**
 * DELETE /api/admin/categories?id=<uuid>
 *
 * Custom override of the generic table-route DELETE. categories has a
 * self-referential parent_id with no DB-side ON DELETE CASCADE, so the
 * naive `DELETE FROM categories WHERE id = $1` left every subcategory
 * orphaned with a dangling parent_id pointing at the now-deleted parent.
 *
 * The /admin/categories UI's confirm modal already promises
 * "이 카테고리와 모든 서브카테고리가 삭제됩니다" — this delivers on it.
 *
 * Single transaction: subcategories first, then the parent. If the
 * parent delete fails (extremely unlikely after the children went) the
 * transaction rolls back and the children come back too.
 *
 * Products that reference the deleted category via category_id or
 * subcategory_id stay alive but their references become orphans —
 * the storefront category-name lookup handles missing rows gracefully
 * (renders empty), so this is a UI degradation rather than a render
 * failure. The operator can re-categorize via /admin/products if they
 * want the affected rows cleaned up.
 */
export async function DELETE(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return NextResponse.json({ error: 'id_required' }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Subcategories first so the parent's delete doesn't trip
        // any (future) FK constraint we add.
        await client.query(
          `DELETE FROM public.categories WHERE parent_id = $1`,
          [id],
        );
        // Check that the parent category actually existed — without
        // this, deleting a stale/already-deleted id silently returns
        // success and the operator thinks the row went away when in
        // fact nothing happened. (The subcategory delete above is
        // intentionally not checked: it's valid for a leaf category
        // with no children to delete cleanly.)
        const parent = await client.query(
          `DELETE FROM public.categories WHERE id = $1`,
          [id],
        );
        await client.query('COMMIT');
        if ((parent.rowCount ?? 0) === 0) {
          return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => { /* connection may be gone */ });
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[api/admin/categories DELETE] failed:', err);
      return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
    }
  }

  // Non-RDS (dev / pre-cutover) fallback: defer to the generic factory
  // DELETE which doesn't cascade. Acceptable here because the operator
  // is on a dev box that's not the source of truth.
  return route.DELETE(request);
}
