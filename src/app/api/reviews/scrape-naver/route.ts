/**
 * POST /api/reviews/scrape-naver
 *
 * Takes a Naver blog post URL and returns the post's og:title / og:image /
 * og:description so the admin doesn't have to fill those in by hand.
 * Backs the "Naver URL → 자동 채우기" button on /admin/reviews.
 *
 * The route is intentionally tolerant — Naver blog markup varies (mobile
 * vs desktop, m.blog vs blog.naver.com, smart-editor versions), so we
 * regex the head's og:* meta tags rather than a strict parse, and we
 * accept either property/content or content/property attribute orders.
 *
 * Network failure / non-2xx / missing og: tags all return 200 with the
 * fields we could resolve and null for the rest, so the admin form can
 * still partially auto-fill. Only invalid input shape returns 400.
 */

import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface ScrapeResult {
  title: string | null;
  image_url: string | null;
  description: string | null;
  /**
   * Sanitized HTML body of the Naver post — the SmartEditor content
   * inside `<div class="se-main-container">` (newer posts) or the
   * `<div id="postViewArea">` (older posts). Naver-specific elements
   * (sponsor badges, sharing widgets, sticky CTAs, iframes, scripts,
   * inline event handlers) are stripped so the storefront can drop
   * the result straight into the review viewer page with the same
   * `.detail-body` typography as product detail.
   */
  body_html: string | null;
}

// Pull <meta property="og:NAME" content="VALUE"> OR
//      <meta content="VALUE" property="og:NAME"> (Naver sometimes flips the order)
// from the page's HTML head. Returns null when the tag isn't present.
function readOg(html: string, name: 'title' | 'image' | 'description'): string | null {
  const propFirst = new RegExp(
    `<meta\\s+[^>]*property=["']og:${name}["']\\s+[^>]*content=["']([^"']+)["']`,
    'i',
  );
  const contentFirst = new RegExp(
    `<meta\\s+[^>]*content=["']([^"']+)["']\\s+[^>]*property=["']og:${name}["']`,
    'i',
  );
  return html.match(propFirst)?.[1] ?? html.match(contentFirst)?.[1] ?? null;
}

/**
 * Find the opening tag that matches `openTagRegex`, then walk forward
 * counting <div ...> opens and </div> closes until depth returns to 0
 * — that's the matching close of the outer container. Returns the
 * raw HTML between the opening tag's `>` and the matching closing
 * `</div>`, or null if no match / unbalanced markup.
 *
 * Necessary because Naver's SmartEditor 3.0 main container is the
 * outer of a deeply nested tree (each "component" — paragraph,
 * sticker, image, divider — adds 3-4 nested divs). A non-greedy
 * regex match terminates at the first </div> and captures ~1% of
 * the body. Greedy doesn't help either because comments / footer
 * blocks sit AFTER the real container close and would get swallowed.
 */
function balancedDivContent(html: string, openTagRegex: RegExp): string | null {
  const openMatch = openTagRegex.exec(html);
  if (!openMatch) return null;

  // Position right after the opening tag's `>`.
  const startIdx = openMatch.index;
  const openEnd = html.indexOf('>', startIdx + openMatch[0].length - 1);
  if (openEnd === -1) return null;
  const contentStart = openEnd + 1;

  let depth = 1;
  let pos = contentStart;
  const openTagRe = /<div\b/gi;
  const closeTagRe = /<\/div\s*>/gi;

  while (depth > 0 && pos < html.length) {
    openTagRe.lastIndex = pos;
    closeTagRe.lastIndex = pos;
    const nextOpen = openTagRe.exec(html);
    const nextClose = closeTagRe.exec(html);
    if (!nextClose) return null; // malformed — bail rather than over-capture
    if (nextOpen && nextOpen.index < nextClose.index) {
      depth++;
      pos = nextOpen.index + 4;
    } else {
      depth--;
      if (depth === 0) {
        return html.slice(contentStart, nextClose.index);
      }
      pos = nextClose.index + nextClose[0].length;
    }
  }
  return null;
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#x27;/g, "'")
    .replace(/&nbsp;/g, ' ');
}

export async function POST(request: Request): Promise<NextResponse<ScrapeResult | { error: string }>> {
  let body: { url?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url || !/^https?:\/\//i.test(url)) {
    return NextResponse.json({ error: 'invalid_url' }, { status: 400 });
  }

  // Domain allow-list — only Naver blog/post hosts get scraped. Keeps
  // this endpoint from being repurposed as a generic open redirect /
  // SSRF tool. Other review sources can be added by extending the list.
  const allowed = /^(?:https?:\/\/)?(?:www\.|m\.)?(?:blog\.naver\.com|post\.naver\.com|naver\.me)\b/i;
  if (!allowed.test(url)) {
    return NextResponse.json({ error: 'unsupported_host' }, { status: 400 });
  }

  try {
    const html = await fetchAndFollowNaverRedirects(url, 0);
    if (html === null) {
      return NextResponse.json({ title: null, image_url: null, description: null, body_html: null });
    }

    const title = readOg(html, 'title');
    const image_url = readOg(html, 'image');
    const description = readOg(html, 'description');
    const body_html = extractNaverPostBody(html);

    return NextResponse.json({
      title: title ? decodeHtmlEntities(title) : null,
      image_url: image_url ? decodeHtmlEntities(image_url) : null,
      description: description ? decodeHtmlEntities(description) : null,
      body_html,
    });
  } catch (err) {
    console.error('[scrape-naver] fetch failed:', err);
    return NextResponse.json({ title: null, image_url: null, description: null, body_html: null });
  }
}

/**
 * Pull the actual Naver post body out of the raw HTML and strip the
 * page chrome so the storefront review viewer can render it inline
 * with kokkok's own typography.
 *
 * Two known shapes:
 *
 *   - SmartEditor 3.0 (newer posts) — body sits inside
 *     `<div class="se-main-container">`. Used for almost every post
 *     written from the redesigned editor (2018+).
 *   - Legacy / 스마트에디터 2.0 — body sits inside
 *     `<div id="postViewArea">`. Older or imported posts.
 *
 * After extraction we strip <script>, <style>, <iframe>, inline event
 * handlers, and Naver-specific structural classes (sponsor banner,
 * sticky neighbor CTA, comment-count widgets). Images get their
 * lazy-load `data-lazy-src` / `data-src` swapped into `src` so they
 * actually appear when rendered outside Naver's loader.
 */
function extractNaverPostBody(html: string): string | null {
  // SmartEditor 3.0 container — newer posts. Use balanced div counting
  // (not regex) because the body is deeply nested and a non-greedy
  // regex matches the FIRST closing </div> which is just the leading
  // sticker / cover element, capturing maybe 700 chars instead of the
  // 20-50KB real post body. balancedDivContent walks the HTML
  // counting <div / </div> until depth returns to 0.
  let body = balancedDivContent(html, /<div[^>]*class="[^"]*se-main-container[^"]*"[^>]*>/i);

  if (!body) {
    // Legacy 스마트에디터 2.0 container — older or imported posts.
    body = balancedDivContent(html, /<div[^>]*id="postViewArea"[^>]*>/i);
  }

  if (!body) return null;

  return body
    // Remove scripts + styles + iframes outright — none of them belong
    // in a review viewer that uses kokkok's own font + theme tokens.
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<iframe\b[^>]*>[\s\S]*?<\/iframe>/gi, '')
    // Strip inline event handlers (onclick, onload, etc.) — defense
    // in depth even though we render this through dangerouslySetInnerHTML
    // which doesn't execute handlers anyway.
    .replace(/\son\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/\son\w+\s*=\s*'[^']*'/gi, '')
    // Naver's lazy-image loader: rewrite data-lazy-src / data-src into
    // src so the images actually paint when rendered off Naver.
    .replace(/<img\b[^>]*\bdata-lazy-src=["']([^"']+)["'][^>]*>/gi,
             (m, u) => m.replace(/\bsrc=["'][^"']*["']/i, '').replace(/<img/i, `<img src="${u}"`))
    .replace(/<img\b[^>]*\bdata-src=["']([^"']+)["'][^>]*>/gi,
             (m, u) => m.replace(/\bsrc=["'][^"']*["']/i, '').replace(/<img/i, `<img src="${u}"`))
    .trim();
}

/**
 * Naver returns a 180-byte JS-redirect stub for blog.naver.com posts
 * (`<script>top.location.replace('https://m.blog.naver.com/PostView.naver?...')</script>`)
 * instead of the actual post HTML. The og: tags only appear on the
 * PostView endpoint, so we sniff the redirect script and re-fetch.
 * Capped at 2 hops because Naver occasionally chains a second redirect
 * on smart-editor older posts.
 *
 * Returns the final HTML string or null on non-2xx / network error.
 */
async function fetchAndFollowNaverRedirects(url: string, hops: number): Promise<string | null> {
  if (hops > 2) return null;

  const res = await fetch(url, {
    headers: {
      // Mobile UA forces Naver to serve the m.blog.naver.com flavor that
      // carries proper og:image meta tags. Desktop UA gets the same JS
      // redirect dance plus an iframe-wrapped post body where the og:
      // tags live in the wrapper page only.
      'User-Agent':
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
      'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.5',
    },
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) return null;
  const html = await res.text();

  // Detect the JS-redirect stub: short body + a top.location.replace call
  // pointing at another Naver URL. Match unescaped and escaped slashes
  // since Naver emits the URL with backslash-escaped /.
  const redirectMatch = html.match(/top\.location\.replace\(\s*['"]([^'"]+)['"]\s*\)/i);
  if (redirectMatch) {
    const next = redirectMatch[1].replace(/\\\//g, '/');
    if (/^https?:\/\/(?:m\.)?(?:blog|post)\.naver\.com\b/i.test(next)) {
      return fetchAndFollowNaverRedirects(next, hops + 1);
    }
  }

  return html;
}
