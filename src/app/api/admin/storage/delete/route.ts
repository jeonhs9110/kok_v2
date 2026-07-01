import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { sanitizeStorageKey, MAX_STORAGE_KEY_LEN } from '@/lib/storage/keyGuard';
import { assertSameOrigin } from '@/lib/http/csrf';

/**
 * DELETE /api/admin/storage/delete?bucket=<id>&key=<key>
 *
 * Removes an object from the S3 storage bucket. The bucket arg is
 * checked against the same allow-list as /list and prepended to the
 * key — same shape as the list response, so the browser passes the
 * row's bucket + relative key back unchanged.
 */

const ALLOWED_BUCKETS = new Set(['product-images', 'site-assets']);

export async function DELETE(request: Request) {
  // Round 31: prevent cross-origin S3 defacement — a phished admin's
  // cookie was enough to remove any storage object.
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const bucket = url.searchParams.get('bucket');
  const rawKey = url.searchParams.get('key');
  if (!bucket || !ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'invalid_bucket' }, { status: 400 });
  }
  if (!rawKey) {
    return NextResponse.json({ error: 'key_required' }, { status: 400 });
  }
  if (rawKey.length > MAX_STORAGE_KEY_LEN) {
    return NextResponse.json({ error: 'key_too_long' }, { status: 400 });
  }
  const key = sanitizeStorageKey(rawKey);
  if (!key) {
    return NextResponse.json({ error: 'invalid_key' }, { status: 400 });
  }

  try {
    const { deleteObject } = await import('@/lib/storage/s3');
    const ok = await deleteObject(`${bucket}/${key}`);
    if (!ok) return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/admin/storage/delete] failed:', err);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }
}
