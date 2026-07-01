import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';
import { sanitizeStorageKey, MAX_STORAGE_KEY_LEN } from '@/lib/storage/keyGuard';
import { assertSameOrigin } from '@/lib/http/csrf';

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

// Whitelist of acceptable Content-Type values for uploads. Previously
// this route accepted ANY string the client sent, so a compromised or
// careless admin tooling could PUT a .exe to S3 with
// Content-Type: image/png. S3 stores whatever Content-Type the PUT
// uses and serves it back on GET — at which point a customer clicking
// a direct media URL gets browser-trusted MIME on a file the operator
// never intended to expose. Defense in depth: pin the set.
//
// Covers everything the actual admin uploaders use today:
//   - images for products / banners / carousel / sub-hero / logo / promo
//   - video / gif for carousel media-type alt
//
// SVG dropped 2026-06-30: SVGs run JavaScript when served inline from
// our CDN host (same origin as customer cookies). The logo uploader
// uses PNG/WEBP today; if SVG is ever needed back, pair it with
// `ContentDisposition: 'attachment'` and serve from a cookieless host.
const ALLOWED_CONTENT_TYPES = new Set<string>([
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/avif',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
]);

// Brake on presigned-PUT issuance. A compromised admin token could
// mint thousands of 5-min PUT URLs and DOS the bucket. 30/min/IP is
// generous for any real upload session — typical product save fires
// 1–3 PUTs, bulk imports run sequentially.
const putLimiter = createRateLimiter({
  name: 'admin_storage_put',
  limit: 30,
  windowMs: 60 * 1000,
});

// Per-file upload ceiling. 60 MB covers hero video backgrounds (the
// biggest legitimate file class); everything else — product photos,
// carousel slides, promo banners — is well under 10 MB. Signed into
// the presigned URL as Content-Length so S3 rejects any PUT that
// exceeds it, closing the DoS/budget hole where the client's local
// MAX_FILE_SIZE check was trivially bypassable via curl.
const MAX_UPLOAD_BYTES = 60 * 1024 * 1024;

// Strict allow-list of top-level prefixes the admin can write to.
// Prevents a compromised session from overwriting known keys under
// unintended prefixes (site-assets/logo/logo.png, etc.). Bucket
// versioning is on server-side so an overwrite is recoverable, but
// CloudFront caches the new bytes at the same URL immediately —
// defense in depth stops the defacement before it lands.
const ALLOWED_KEY_PREFIXES = [
  'products/',
  'carousel/',
  'logo/',
  'promo-banners/',
  'reviews/',
  'instagram/',
  'sub-hero/',
  'worldwide/',
  'detail-components/',
  'backgrounds/',
  'top-stripe/',
  'assets/',
];

function logReject(reason: string, ctx: Record<string, string | number | null> = {}): void {
  try {
    console.warn(JSON.stringify({ event: 'storage.put.rejected', reason, ...ctx }));
  } catch { /* never fail on log */ }
}

export async function POST(request: NextRequest) {
  // Round 31: presigned uploads are the vector for arbitrary S3 write —
  // require same-origin so a phished admin can't hand a cross-origin
  // page a signed URL that then uploads defacement content.
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  if (!putLimiter.check(getRequestIp(request))) {
    logReject('rate_limit');
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

  let body: { key?: unknown; contentType?: unknown; size?: unknown };
  try {
    body = await request.json();
  } catch {
    logReject('invalid_json');
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const rawKey = typeof body.key === 'string' ? body.key.trim() : '';
  const contentType = typeof body.contentType === 'string' ? body.contentType.trim().toLowerCase() : '';
  const size = typeof body.size === 'number' && Number.isFinite(body.size) ? Math.floor(body.size) : null;
  if (!rawKey || !contentType) {
    logReject('missing_key_or_content_type');
    return NextResponse.json({ error: 'key_and_contentType_required' }, { status: 400 });
  }
  if (rawKey.length > MAX_STORAGE_KEY_LEN) {
    logReject('key_too_long', { length: rawKey.length });
    return NextResponse.json({ error: 'key_too_long' }, { status: 400 });
  }
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
    logReject('unsupported_content_type', { contentType });
    return NextResponse.json({ error: 'unsupported_content_type' }, { status: 400 });
  }
  if (size === null || size <= 0) {
    logReject('size_required');
    return NextResponse.json({ error: 'size_required' }, { status: 400 });
  }
  if (size > MAX_UPLOAD_BYTES) {
    logReject('file_too_large', { size, max: MAX_UPLOAD_BYTES });
    return NextResponse.json({ error: 'file_too_large', maxBytes: MAX_UPLOAD_BYTES }, { status: 413 });
  }
  const key = sanitizeStorageKey(rawKey);
  if (!key) {
    logReject('invalid_key');
    return NextResponse.json({ error: 'invalid_key' }, { status: 400 });
  }
  if (!ALLOWED_KEY_PREFIXES.some(p => key.startsWith(p))) {
    logReject('invalid_key_prefix', { key });
    return NextResponse.json({ error: 'invalid_key_prefix' }, { status: 400 });
  }

  try {
    const { presignedPutUrl, publicUrl } = await import('@/lib/storage/s3');
    const uploadUrl = await presignedPutUrl(key, contentType, size);
    return NextResponse.json({ uploadUrl, publicUrl: publicUrl(key) });
  } catch (err) {
    console.error('[api/admin/storage/presigned-put] failed:', err);
    return NextResponse.json({ error: 'presign_failed' }, { status: 500 });
  }
}
