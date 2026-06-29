/**
 * Minimal HTML sanitizer for operator-authored content rendered via
 * `dangerouslySetInnerHTML`. Strips the obvious vectors:
 *
 *   - `<script>` blocks (any attributes, multi-line bodies)
 *   - inline event handlers (`onclick=`, `onload=`, etc.)
 *   - `<iframe>`, `<object>`, `<embed>` tags (embeddable plugins / cross-origin frames)
 *   - `javascript:` URLs (in `href`, `src`, anywhere)
 *
 * Originally lived inline in `[lang]/pages/[slug]/page.tsx`. Pulled out
 * 2026-06-29 so the reviews detail page (`[lang]/reviews/[id]`) can
 * apply the same rule — that route was rendering `review.content_html`
 * raw, which trusted both the admin operator AND the Naver-scrape pipe
 * upstream more than it should. Defense in depth.
 *
 * NOT a substitute for a real HTML parser-based sanitizer (DOMPurify
 * etc.) — those don't run cleanly in a server component without
 * shimming. For trust-boundary inputs (customer-submitted HTML), still
 * use DOMPurify on the client before rendering. This is for
 * operator-controlled content that we want to defang as a safety net.
 */
export function sanitizeHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    .replace(/<iframe\b[^>]*>/gi, '')
    .replace(/<object\b[^>]*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '');
}
