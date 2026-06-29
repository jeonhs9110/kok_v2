import { NextResponse, type NextRequest } from 'next/server';

/**
 * Root-only language redirect.
 *
 * The storefront homepage lives under `[lang]/page.tsx` — a bare hit to
 * `/` matches no route and 404s. This redirects `/` → `/kr` (when the
 * client's `Accept-Language` advertises Korean) or `/en` otherwise, so
 * a customer typing `kokkokgarden.com` lands on a real page.
 *
 * Scope is deliberately narrow:
 *   - `matcher: ['/']` fires ONLY on the bare root.
 *   - `/login`, `/cart`, `/products`, `/admin/*`, `/api/*`, `/_next/*`
 *     etc. are unaffected — none of those segments are under `[lang]`,
 *     they're top-level routes that work without a language prefix.
 *
 * 302 (not 301) because the language preference is a per-request decision,
 * not a permanent canonical mapping. A customer who flips browsers from
 * Korean to English should land somewhere different next time.
 */
export const config = {
  matcher: ['/'],
};

export function middleware(req: NextRequest) {
  // Accept-Language uses a comma-separated quality-weighted list, e.g.
  // "ko-KR,ko;q=0.9,en;q=0.8". A simple "is Korean the first preference?"
  // check is sufficient — we only have two languages, and any tie-break
  // beyond "prefers Korean / doesn't" doesn't change the destination.
  const accept = req.headers.get('accept-language') ?? '';
  const prefersKorean = /^\s*ko\b/i.test(accept);
  const lang = prefersKorean ? 'kr' : 'en';

  const url = req.nextUrl.clone();
  url.pathname = `/${lang}`;
  return NextResponse.redirect(url, 302);
}
