/**
 * Phase E2 — shared upload helper for the admin browser hooks.
 *
 * USE_S3_FROM_BROWSER=true: presigned-PUT to S3 (no Supabase Storage hop).
 *   1. POST /api/admin/storage/presigned-put with { key, contentType }
 *   2. PUT the file directly to the returned uploadUrl
 *   3. Persist publicUrl in the row
 *
 * Otherwise: the caller's existing Supabase Storage flow runs unchanged
 * — this helper is opt-in per hook so the rewires can land table-by-table.
 *
 * Key shape mirrors the Supabase bucket layout so a rollback (flip flag
 * back to false) keeps the persisted URLs reachable IF you also mirror
 * the S3 objects back into Supabase — see the Phase F runbook's rollback
 * caveats before relying on this property.
 */
export const USE_S3_FROM_BROWSER = process.env.NEXT_PUBLIC_USE_S3 === 'true';

export interface UploadOptions {
  /** Folder prefix inside the bucket. e.g. 'products' → 'products/<file>'. */
  keyPrefix: string;
  /** Defaults to file.type. Used to set the S3 object's Content-Type. */
  contentType?: string;
}

export interface UploadResult {
  publicUrl: string;
  key: string;
}

/**
 * Returns the public URL of the uploaded object. Throws on any failure
 * so the caller can show its existing error toast — no defensive empty
 * string that would silently corrupt the persisted row.
 */
export async function uploadFileToS3(file: File, opts: UploadOptions): Promise<UploadResult> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin';
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 10);
  const key = `${opts.keyPrefix.replace(/^\/+|\/+$/g, '')}/${stamp}-${rand}.${ext}`;
  const contentType = opts.contentType ?? file.type ?? 'application/octet-stream';

  const presignRes = await fetch('/api/admin/storage/presigned-put', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, contentType }),
  });
  if (!presignRes.ok) {
    throw new Error(`presigned-put_${presignRes.status}`);
  }
  const { uploadUrl, publicUrl } = await presignRes.json() as { uploadUrl: string; publicUrl: string };

  const putRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: file,
  });
  if (!putRes.ok) {
    throw new Error(`s3_put_${putRes.status}`);
  }

  return { publicUrl, key };
}
