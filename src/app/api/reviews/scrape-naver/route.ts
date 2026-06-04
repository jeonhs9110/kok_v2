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
    const res = await fetch(url, {
      headers: {
        // Naver returns mobile-flavored markup when it sees a mobile UA,
        // and the mobile pages tend to have richer og:image data than
        // the desktop iframe wrappers. Spoofing here makes the scrape
        // succeed more often than not.
        'User-Agent':
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1',
        'Accept-Language': 'ko-KR,ko;q=0.9,en;q=0.5',
      },
      // Match the timeout shape used elsewhere in the codebase
      // (homepage cache uses 3s; pages here are admin-triggered so a
      // touch longer is fine).
      signal: AbortSignal.timeout(6000),
    });

    if (!res.ok) {
      return NextResponse.json({ title: null, image_url: null, description: null });
    }

    const html = await res.text();
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
