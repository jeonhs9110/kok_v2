import 'server-only';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  type PutObjectCommandInput,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

/**
 * Phase E — server-side S3 storage helpers.
 *
 * One S3Client per process. Credentials come from the standard AWS
 * provider chain (instance-profile on EC2, env vars / shared config
 * locally) — never read AWS_* secrets explicitly here.
 *
 * Buckets:
 *   - S3_STORAGE_BUCKET: assets uploaded by admins (product images,
 *     hero banners, shorts thumbnails, instagram tiles, etc.).
 *     Provisioned by `infrastructure/s3.tf` as
 *     `${project_name}-storage-${random_id.suffix.hex}`.
 *
 * Public read URLs:
 *   - When S3_PUBLIC_CDN_URL is set (CloudFront wired in Phase F),
 *     publicUrl() returns the CDN host so the bucket itself can stay
 *     fully blocked from public access.
 *   - When unset, callers should presign a GET per request (not
 *     covered here — read paths are not wired until F).
 */

interface UploadResult {
  key: string;
  publicUrl: string;
}

const DEFAULT_PRESIGN_EXPIRES_SECONDS = 60 * 5; // 5 min — long enough for an admin click-to-upload

let _client: S3Client | null = null;
function getClient(): S3Client {
  if (_client) return _client;
  _client = new S3Client({
    region: process.env.AWS_REGION ?? 'ap-northeast-2',
  });
  return _client;
}

function bucket(): string {
  const b = process.env.S3_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_S3_STORAGE_BUCKET;
  if (!b) {
    throw new Error(
      '[storage/s3] S3_STORAGE_BUCKET is not set. ' +
      'Run `terraform output storage_bucket_name` in infrastructure/ and ' +
      'add it to .env / the EC2 process env.',
    );
  }
  return b;
}

/**
 * URL the storefront should use to render an uploaded asset.
 *
 * Prefers S3_PUBLIC_CDN_URL (CloudFront, set in Phase F). Falls back
 * to the raw S3 virtual-hosted style URL — fine for dev / smoke
 * testing once the bucket policy permits anonymous reads, broken
 * otherwise. publicUrl() never signs the URL: presigned GETs would
 * leak into the page HTML and rotate every few minutes, which breaks
 * caching at every layer.
 */
export function publicUrl(key: string): string {
  const cdn = process.env.S3_PUBLIC_CDN_URL ?? process.env.NEXT_PUBLIC_S3_PUBLIC_CDN_URL;
  if (cdn) {
    const base = cdn.replace(/\/$/, '');
    const path = key.startsWith('/') ? key : `/${key}`;
    return `${base}${path}`;
  }
  const region = process.env.AWS_REGION ?? 'ap-northeast-2';
  return `https://${bucket()}.s3.${region}.amazonaws.com/${encodeURI(key)}`;
}

// Long-cache header for immutable uploads. Every admin browser
// upload lands under a `{timestamp}-{rand}.{ext}` key that we never
// re-write, so declaring the object immutable + a 1-year max-age
// lets CloudFront and every downstream browser cache aggressively
// instead of falling back to the default 1-day TTL.
const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

/**
 * Server-side upload. Use for small payloads originating server-side
 * (e.g. import scripts, ingest jobs). For admin browser uploads,
 * prefer presignedPutUrl() so the file does not transit through the
 * Next.js process.
 */
export async function putObject(
  key: string,
  body: PutObjectCommandInput['Body'],
  contentType?: string,
): Promise<UploadResult> {
  const Bucket = bucket();
  await getClient().send(new PutObjectCommand({
    Bucket,
    Key: key,
    Body: body,
    ContentType: contentType,
    CacheControl: IMMUTABLE_CACHE_CONTROL,
  }));
  return { key, publicUrl: publicUrl(key) };
}

export async function deleteObject(key: string): Promise<boolean> {
  try {
    await getClient().send(new DeleteObjectCommand({
      Bucket: bucket(),
      Key: key,
    }));
    return true;
  } catch (err) {
    console.error('[storage/s3] deleteObject failed:', err);
    return false;
  }
}

export interface S3ListedObject {
  key: string;
  size: number;
  updatedAt: string;
  publicUrl: string;
}

/**
 * List every object under `prefix` in the storage bucket. Handles
 * ListObjectsV2 pagination (1000 keys per page).
 *
 * Used by /admin/assets after the cutover swaps storage to S3. The
 * existing browser page passes `<supabase-bucket>/` as the prefix
 * since the mirror script writes objects under that namespace.
 */
export async function listObjects(prefix: string): Promise<S3ListedObject[]> {
  const Bucket = bucket();
  const out: S3ListedObject[] = [];
  let token: string | undefined;
  do {
    const res = await getClient().send(new ListObjectsV2Command({
      Bucket,
      Prefix: prefix,
      ContinuationToken: token,
      MaxKeys: 1000,
    }));
    for (const obj of res.Contents ?? []) {
      if (!obj.Key) continue;
      out.push({
        key: obj.Key,
        size: obj.Size ?? 0,
        updatedAt: obj.LastModified?.toISOString() ?? '',
        publicUrl: publicUrl(obj.Key),
      });
    }
    token = res.IsTruncated ? res.NextContinuationToken : undefined;
  } while (token);
  return out;
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getClient().send(new HeadObjectCommand({
      Bucket: bucket(),
      Key: key,
    }));
    return true;
  } catch {
    return false;
  }
}

/**
 * Returns a presigned PUT URL the admin browser can upload to
 * directly. Keeps large files off the Next.js process and out of the
 * Lambda/EC2 request budget.
 *
 * When `contentLength` is provided, it's signed into the URL — the
 * browser's fetch(PUT, body:File) auto-sets Content-Length to
 * file.size, and S3 rejects the request if it doesn't match the
 * signed value. That's the actual DoS/budget guard: a compromised
 * admin session can no longer PUT a 5GB file through this URL, even
 * though the client-side MAX_FILE_SIZE check is trivially bypassable.
 *
 * CacheControl is signed too so a client can't override it — every
 * public.kokkokgarden.com/media/{key} response carries the immutable
 * hint on the first cold fetch.
 *
 * Pair with publicUrl(key) for the read URL after upload succeeds.
 */
export async function presignedPutUrl(
  key: string,
  contentType: string,
  contentLength?: number,
  expiresInSeconds: number = DEFAULT_PRESIGN_EXPIRES_SECONDS,
): Promise<string> {
  const cmd = new PutObjectCommand({
    Bucket: bucket(),
    Key: key,
    ContentType: contentType,
    ContentLength: contentLength,
    CacheControl: IMMUTABLE_CACHE_CONTROL,
  });
  // Signed headers that browsers set implicitly (Content-Length,
  // Content-Type) need to stay in the signed request, not hoisted
  // to the query string, so S3 can validate them against what the
  // browser sends. Cache-Control is signed too — the client echoes
  // it back in the PUT header (see uploadFile.ts) so the stored
  // object carries the immutable directive.
  return await getSignedUrl(getClient(), cmd, {
    expiresIn: expiresInSeconds,
    unhoistableHeaders: new Set(
      contentLength !== undefined
        ? ['content-length', 'cache-control']
        : ['cache-control'],
    ),
  });
}
