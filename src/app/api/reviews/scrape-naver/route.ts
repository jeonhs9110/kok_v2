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
      return NextResponse.json({ title: null, image_url: null, description: null });
    }

    const title = readOg(html, 'title');
    const image_url = readOg(html, 'image');
    const description = readOg(html, 'description');

    return NextResponse.json({
      title: title ? decodeHtmlEntities(title) : null,
      image_url: image_url ? decodeHtmlEntities(image_url) : null,
      description: description ? decodeHtmlEntities(description) : null,
    });
  } catch (err) {
    console.error('[scrape-naver] fetch failed:', err);
    return NextResponse.json({ title: null, image_url: null, description: null });
  }
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
