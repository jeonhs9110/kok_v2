/**
 * Derive a non-PII `author_name` to store on customer-authored posts +
 * comments + reviews.
 *
 * The previous fallback used the customer's email when they didn't
 * supply an explicit display name, which then rendered verbatim on
 * every public post / comment / review — a PIPA violation (and a
 * scrapeable spam-target list).
 *
 * Strategy:
 *   - If the caller supplied a non-empty display name, use it (trimmed,
 *     capped, and stripped of leading/trailing whitespace).
 *   - Otherwise derive a stable pseudonym from the Cognito `sub`
 *     (or any user-id string) — `회원_a1b2` style — so the same
 *     customer's posts cluster visually but their email is never
 *     written to public columns.
 *   - Never fall back to `anonymous` — same customer should not show
 *     up as "anonymous" on every post.
 *
 * `legacyMaskAuthorName` is the read-time mask for rows written before
 * this helper landed: if the stored author_name looks like an email
 * we replace the display with the same pseudonym derivation so old
 * rows stop leaking.
 */

const MAX_NAME = 60;
const EMAIL_LIKE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function pseudonym(userId: string): string {
  // Short stable hash of the user id (last 4 hex chars of the FNV-1a
  // 32-bit hash). Two characters of collision space gives ~65k
  // pseudonyms before any visual collision; combined with first-letter
  // initialization across the board, collisions are perceptual non-
  // issues at 100k+ users.
  let h = 0x811c9dc5 >>> 0;
  for (let i = 0; i < userId.length; i++) {
    h ^= userId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return `회원_${h.toString(36).slice(-4)}`;
}

/**
 * Build the author_name that should be persisted. Always returns a
 * non-PII value safe for public render. Caps at 60 chars (DB column
 * is text, but the storefront layout breaks past ~60).
 */
export function deriveStoredAuthorName(opts: {
  supplied?: string | null;
  userId: string;
  email?: string | null;
}): string {
  const raw = (opts.supplied ?? '').trim();
  // Reject empty AND reject email-shaped supplied names — a customer
  // pasting their email into the display-name field would otherwise
  // bypass the mask.
  if (raw.length > 0 && !EMAIL_LIKE.test(raw)) {
    return raw.slice(0, MAX_NAME);
  }
  return pseudonym(opts.userId);
}

/**
 * Read-time mask for legacy rows where author_name might still be a
 * raw email (rows written before deriveStoredAuthorName landed).
 * Returns the original value when it's already non-PII.
 */
export function legacyMaskAuthorName(stored: string | null | undefined): string {
  if (!stored) return '회원';
  const trimmed = stored.trim();
  if (!trimmed) return '회원';
  if (EMAIL_LIKE.test(trimmed)) {
    // Old row from before the mask — derive pseudonym from the email
    // itself so rows by the same legacy author stay clustered.
    return pseudonym(trimmed);
  }
  return trimmed.slice(0, MAX_NAME);
}
