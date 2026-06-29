/**
 * Shared sanitizer for S3 object keys arriving from the admin browser.
 *
 * S3 treats `/` as a flat key separator, so a path-traversal-shaped key
 * like `site-assets/../product-images/products/1.jpg` is a real
 * cross-prefix overwrite vector: the bucket happily writes the
 * literal string to that key, and the storefront resolves it back to
 * a product image. The previous gate (`key.includes('..')`) was a one-
 * round defense — it missed:
 *
 *   - Backslash variants: `..\\foo` (Windows-style admin tooling)
 *   - URL-encoded: `%2e%2e%2f`, `%2E%2E/`
 *   - Mixed encoding: `..%2f`, `%2e./`
 *   - NUL bytes: `foo\0bar` (terminates the key in some clients)
 *
 * This helper decodes once (rejecting malformed sequences), reuses the
 * decoded string for the same rejection set, and returns the canonical
 * key or null. Callers should treat null as a 400.
 */

export const MAX_STORAGE_KEY_LEN = 512;

const TRAVERSAL_RE = /(^|[/\\])\.\.([/\\]|$)/;

export function sanitizeStorageKey(raw: string): string | null {
  if (!raw) return null;
  if (raw.length > MAX_STORAGE_KEY_LEN) return null;
  if (raw.startsWith('/') || raw.startsWith('\\')) return null;
  if (raw.includes('\x00')) return null;
  if (raw.includes('\\')) return null;

  // Decode once. Reject any URL-encoded segment that hides traversal.
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  if (decoded.startsWith('/') || decoded.startsWith('\\')) return null;
  if (decoded.includes('\x00')) return null;
  if (decoded.includes('\\')) return null;
  if (TRAVERSAL_RE.test(decoded)) return null;
  if (TRAVERSAL_RE.test(raw)) return null;

  return raw;
}
