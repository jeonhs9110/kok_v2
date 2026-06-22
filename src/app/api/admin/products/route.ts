import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import type { AdminProductUpsertInput } from '@/lib/db/admin-writes';

/**
 * Phase C2b — admin products CRUD route.
 *
 * Activated when admin hooks (useProducts / useProductForm) flip to
 * `NEXT_PUBLIC_USE_RDS=true`. Until then the hooks still hit Supabase
 * directly from the browser and this route is reachable but unused.
 *
 * Always gated by `requireAdmin()`. Same gate as the legacy direct
 * supabase path enforced via RLS — but here the check happens at the
 * route boundary because pg has no RLS.
 *
 * Operations:
 *   GET    — list all products (admin view, includes inactive)
 *   POST   — create a product
 *   PATCH  — update existing product OR toggle is_active
 *            (?id=<uuid>; body shape determines op:
 *              { is_active: boolean } → toggle
 *              full payload           → full update)
 *   DELETE — delete a product (?id=<uuid>)
 */

function badRequest(error: string) {
  return NextResponse.json({ error }, { status: 400 });
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { listProductsForAdminInPg } = await import('@/lib/db/admin-writes');
    const rows = await listProductsForAdminInPg();
    return NextResponse.json({ rows });
  } catch (err) {
    console.error('[api/admin/products GET] failed:', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  let body: AdminProductUpsertInput;
  try {
    body = (await request.json()) as AdminProductUpsertInput;
  } catch {
    return badRequest('invalid_json');
  }
  const validationError = validateProductPayload(body);
  if (validationError) return badRequest(validationError);
  try {
    const { createProductInPg } = await import('@/lib/db/admin-writes');
    const row = await createProductInPg(body);
    if (!row) return NextResponse.json({ error: 'create_failed' }, { status: 500 });
    return NextResponse.json({ row });
  } catch (err) {
    console.error('[api/admin/products POST] failed:', err);
    return NextResponse.json({ error: 'create_failed' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return badRequest('id_required');

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return badRequest('invalid_json');
  }

  // Toggle-only path — operator clicks "활성/비활성" on the list view.
  // Keeps the heavy validation out of the way for the hot path.
  if (Object.keys(body).length === 1 && typeof body.is_active === 'boolean') {
    try {
      const { setProductActiveInPg } = await import('@/lib/db/admin-writes');
      const ok = await setProductActiveInPg(id, body.is_active);
      return NextResponse.json({ ok });
    } catch (err) {
      console.error('[api/admin/products PATCH toggle] failed:', err);
      return NextResponse.json({ error: 'toggle_failed' }, { status: 500 });
    }
  }

  const payload = body as unknown as AdminProductUpsertInput;
  const validationError = validateProductPayload(payload);
  if (validationError) return badRequest(validationError);
  try {
    const { updateProductInPg } = await import('@/lib/db/admin-writes');
    const ok = await updateProductInPg(id, payload);
    return NextResponse.json({ ok });
  } catch (err) {
    console.error('[api/admin/products PATCH] failed:', err);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return badRequest('id_required');
  try {
    const { deleteProductInPg } = await import('@/lib/db/admin-writes');
    const ok = await deleteProductInPg(id);
    return NextResponse.json({ ok });
  } catch (err) {
    console.error('[api/admin/products DELETE] failed:', err);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}

// Allow-list against mass-assignment. Anything the form doesn't send
// gets nulled at the DB layer; anything sent that isn't here just
// doesn't propagate. Keeps the surface explicit.
function validateProductPayload(body: AdminProductUpsertInput): string | null {
  if (!body || typeof body !== 'object') return 'invalid_body';
  if (typeof body.name !== 'string' || body.name.trim().length === 0) return 'name_required';
  if (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0) return 'price_invalid';
  if (!Array.isArray(body.images)) return 'images_invalid';
  return null;
}
