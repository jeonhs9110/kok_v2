/**
 * Whitelist-check an admin-controlled URL before it lands in an
 * `<a href={...}>` or `<Link href={...}>` on a customer-facing page.
 *
 * Operators type these URLs in /admin/* (carousel slides, promo banners,
 * homepage banners, sub-hero, top-stripe, Instagram tiles, CMS page
 * blocks, etc.). Admin is trusted in the normal case — but a typo or a
 * compromised admin account submitting `javascript:alert(1)` would
 * execute on every visitor who clicked the broken banner. Defense in
 * depth: kill the unsafe schemes at the render boundary.
 *
 * Allow-list:
 *   - http:// and https://
 *   - mailto: and tel:
 *   - protocol-relative `//` URLs (treat as https on most clients)
 *   - relative paths starting with `/`
 *   - in-page anchors starting with `#`
 *   - the literal `#` (used as a "no link yet" placeholder)
 *
 * Everything else (javascript:, data:, vbscript:, file:, custom
 * app-schemes) collapses to `'#'` so the link is inert. The caller can
 * decide whether to render the wrapper at all (e.g., promo banner does
 * "use href OR '#'" to keep markup stable).
 *
 * Falsy / null / undefined → `'#'` for the same inert-fallback reason.
 */
export function safeUrl(raw: string | null | undefined): string {
  if (!raw) return '#';
  const trimmed = String(raw).trim();
  if (!trimmed) return '#';
  if (trimmed === '#') return '#';
  // Anchors + relative paths.
  if (trimmed.startsWith('#')) return trimmed;
  if (trimmed.startsWith('/')) return trimmed;
  // Allow-listed schemes. Match case-insensitively because attackers
  // routinely lowercase-cycle the scheme to bypass naive checks
  // ("JaVaScRiPt:" is the classic).
  const lower = trimmed.toLowerCase();
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('mailto:') ||
    lower.startsWith('tel:')
  ) {
    return trimmed;
  }
  // Inert fallback. Explicit `'#'` rather than '' so callers can still
  // wrap the link element without it being a navigable URL.
  return '#';
}
