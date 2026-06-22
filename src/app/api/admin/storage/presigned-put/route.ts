import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

/**
 * POST /api/admin/storage/presigned-put
 *
 * Body: { key: string, contentType: string }
 * Returns: { uploadUrl: string, publicUrl: string }
 *
 * Admin browser uploads call this once per file, then PUT the file
 * directly to `uploadUrl`. Keeps large payloads out of the Next.js
 * process and out of the EC2 request budget.
 *
 * Activated when admin upload hooks switch to S3 (USE_S3=true at
 * cutover). Until then the route is reachable but no caller hits it.
 */
export async function POST(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: { key?: unknown; contentType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const key = typeof body.key === 'string' ? body.key.trim() : '';
  const contentType = typeof body.contentType === 'string' ? body.contentType.trim() : '';
  if (!key || !contentType) {
    return NextResponse.json({ error: 'key_and_contentType_required' }, { status: 400 });
  }
  // Don't let callers reach outside the bucket. A leading slash or `..`
  // segment would be inert at S3's API but we strip anyway to keep the
  // key shape predictable in downstream URLs.
  if (key.startsWith('/') || key.includes('..')) {
    return NextResponse.json({ error: 'invalid_key' }, { status: 400 });
  }

  try {
    const { presignedPutUrl, publicUrl } = await import('@/lib/storage/s3');
    const uploadUrl = await presignedPutUrl(key, contentType);
    return NextResponse.json({ uploadUrl, publicUrl: publicUrl(key) });
  } catch (err) {
    console.error('[api/admin/storage/presigned-put] failed:', err);
    return NextResponse.json({ error: 'presign_failed' }, { status: 500 });
  }
}
