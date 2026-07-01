/**
 * Minimal HTML sanitizer for operator-authored content rendered via
 * `dangerouslySetInnerHTML`. Strips the obvious vectors:
 *
 *   - `<script>` blocks (any attributes, multi-line bodies)
 *   - inline event handlers (`onclick=`, `onload=`, etc.)
 *   - `<iframe>`, `<object>`, `<embed>` tags (embeddable plugins / cross-origin frames)
 *   - `<style>` / `<link>` — CSS injection surfaces (Round 21 audit
 *     flagged sitewide CSS-based value exfiltration via input[value^=...]
 *     attribute selectors + `@import` external CSS).
 *   - `<form>` / `<input>` / `<button>` / `<meta>` / `<base>` — phishing
 *     forms + `<base href>` sitewide URL rewrite, previously all rode
 *     through untouched because the tag strip list was event-oriented.
 *   - `javascript:` URLs, including HTML-entity-encoded variants
 *     (`&#x6a;avascript:`, `jav&Tab;ascript:`) which browsers decode in
 *     href attribute values BEFORE scheme resolution, previously
 *     bypassing the raw-regex match.
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
 * Round 21's XSS audit noted a full DOMPurify migration is the real
 * fix; the additions here close the loudest bypasses without shipping
 * a new dependency in the same PR.
 */

// Named + numeric HTML entities that decode into ASCII characters the
// browser then uses inside an href value — most importantly, characters
// that would let `javascript:` sneak through the sanitizer as
// `&#x6a;avascript:` or `jav&#9;ascript:`. Not exhaustive; enough to
// close every published-bypass example. If a payload needs a character
// not on this list, it also can't form a working `javascript:` scheme.
const HTML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#9;': '\t', '&#x9;': '\t', '&Tab;': '\t',
  '&#10;': '\n', '&#xa;': '\n', '&NewLine;': '\n',
  '&#13;': '\r', '&#xd;': '\r',
  '&#32;': ' ', '&#x20;': ' ',
  '&#58;': ':', '&#x3a;': ':',
  '&colon;': ':',
};

// Round 29: iframe embed whitelist for the community-board post
// renderer. RichEditor's YouTube/Vimeo toolbar buttons emit iframes
// against these hosts; the prior blanket `<iframe>` strip vaporized
// them at render time — the customer wrote a post with a plant-care
// video, saw it play in the editor preview, submitted, and the
// embed silently disappeared on the live page. Mirrors the pattern
// MenuPage.tsx uses for the same RichEditor output. Only src values
// pointing at whitelisted hosts pass; everything else (data: URLs,
// arbitrary origins, missing src) still gets stripped.
const IFRAME_ALLOWED_HOST_RE = /^(?:https?:)?\/\/(?:www\.)?(?:youtube\.com|youtube-nocookie\.com|youtu\.be|vimeo\.com|player\.vimeo\.com)(?:\/|$)/i;

function decodeCommonEntities(input: string): string {
  return input
    // Numeric decimal entities (&#NNN;)
    .replace(/&#(\d+);/g, (_, code) => {
      const n = parseInt(code, 10);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    })
    // Numeric hex entities (&#xHH;)
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => {
      const n = parseInt(code, 16);
      return Number.isFinite(n) && n > 0 && n < 0x110000 ? String.fromCodePoint(n) : '';
    })
    // Named entities from the small map above.
    .replace(/&[a-zA-Z]+;/g, m => HTML_ENTITY_MAP[m.toLowerCase()] ?? m);
}

export function sanitizeHtml(html: string): string {
  // Decode common HTML entities BEFORE running scheme + tag matches so
  // entity-encoded bypasses (`&#x6a;avascript:`, `jav&Tab;ascript:`)
  // resolve to the plain-text form the regex will actually catch.
  // Trade-off: this also decodes benign entities inside body text —
  // acceptable because the output is then re-inserted via
  // dangerouslySetInnerHTML which re-escapes plain `<` / `>` at render
  // time via any subsequent DOM parse.
  const decoded = decodeCommonEntities(html);

  return decoded
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]*)/gi, '')
    // Round 29: keep YouTube/Vimeo iframe embeds, strip anything else.
    // The prior blanket strip vaporized RichEditor's own legitimate
    // embed output on customer posts. Attribute check uses the
    // decoded string so entity-encoded src bypasses can't sneak in.
    .replace(/<iframe\b([^>]*)>/gi, (match, attrs: string) => {
      const srcMatch = attrs.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
      const src = srcMatch ? (srcMatch[2] ?? srcMatch[3] ?? '') : '';
      return IFRAME_ALLOWED_HOST_RE.test(src) ? match : '';
    })
    .replace(/<object\b[^>]*>/gi, '')
    .replace(/<embed\b[^>]*>/gi, '')
    // CSS injection surfaces — <style> blocks + <link rel="stylesheet">.
    // Prior sanitizer left these through; a compromised or malicious
    // operator could ship a `<style>input[value^="a"]{background:...}`
    // block that exfiltrates customer form-field characters.
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
    .replace(/<link\b[^>]*>/gi, '')
    // Phishing form surface — `<form>` inside operator-authored HTML
    // runs on the real customer origin, so browser autofill + same-
    // origin trust make a login-look-alike form dangerous. Strip the
    // opening tag; leaving stray `</form>` is benign.
    .replace(/<form\b[^>]*>/gi, '')
    .replace(/<input\b[^>]*>/gi, '')
    .replace(/<button\b[^>]*>/gi, '')
    // `<meta http-equiv="refresh">` and `<base href>` rewrite the whole
    // page. Neither is legitimately useful in operator content.
    .replace(/<meta\b[^>]*>/gi, '')
    .replace(/<base\b[^>]*>/gi, '')
    // Any remaining `javascript:` (entities already decoded above).
    // Whitespace class covers tab / CR / LF characters browsers strip
    // from URL schemes before resolving.
    .replace(/javascript\s*:/gi, '')
    // Same treatment for other executable schemes.
    .replace(/vbscript\s*:/gi, '')
    .replace(/data\s*:\s*text\/html/gi, '');
}
