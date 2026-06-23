import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

/**
 * GET /api/admin/storage/list?bucket=<id>
 *
 * Returns every object under the given Supabase-bucket-id prefix in the
 * S3 storage bucket. The mirror script writes objects with this layout:
 *
 *   s3://kokkok-storage-…/product-images/products/<file>
 *   s3://kokkok-storage-…/site-assets/logo/<file>
 *
 * so the asset browser passes the supabase bucket id as the filter and
 * we just prepend it to the prefix.
 *
 * Returns:
 *   { rows: [{ bucket, key, name, size, updatedAt, publicUrl }] }
 *
 * Key shapes match the existing Asset interface in
 * /admin/assets/_components/types so the page can swap between the
 * Supabase and S3 list sources without normalizing.
 */

const ALLOWED_BUCKETS = new Set(['product-images', 'site-assets']);

export async function GET(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(request.url);
  const bucket = url.searchParams.get('bucket');
  if (!bucket || !ALLOWED_BUCKETS.has(bucket)) {
    return NextResponse.json({ error: 'invalid_bucket' }, { status: 400 });
  }

  try {
    const { listObjects } = await import('@/lib/storage/s3');
    const raw = await listObjects(`${bucket}/`);
    const rows = raw.map(o => {
      // Strip the `<bucket>/` prefix from the key so the UI shows the
      // same relative path it does under Supabase ("products/abc.jpg"
      // not "product-images/products/abc.jpg").
      const relKey = o.key.startsWith(`${bucket}/`)
        ? o.key.slice(bucket.length + 1)
        : o.key;
      const name = relKey.split('/').pop() ?? relKey;
      return {
        bucket,
        key: relKey,
        name,
        size: o.size,
        updatedAt: o.updatedAt,
        kind: kindFromName(name),
        publicUrl: o.publicUrl,
      };
    });
    return NextResponse.json({ rows });
  } catch (err) {
    console.error('[api/admin/storage/list] failed:', err);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'avif']);
const VIDEO_EXTS = new Set(['mp4', 'webm', 'mov']);
function kindFromName(name: string): 'image' | 'video' | 'other' {
  const ext = (name.split('.').pop() ?? '').toLowerCase();
  if (IMAGE_EXTS.has(ext)) return 'image';
  if (VIDEO_EXTS.has(ext)) return 'video';
  return 'other';
}
