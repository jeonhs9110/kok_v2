import { NextResponse, type NextRequest } from 'next/server';

const VALID_LANGS = ['kr', 'en'] as const;
type ValidLang = (typeof VALID_LANGS)[number];

/**
 * Visitor country detection.
 *
 * Three sources, in priority order:
 *   1. `cloudfront-viewer-country` — populated by the prod CloudFront
 *      distribution that fronts the ALB. Authoritative when present.
 *   2. `x-vercel-ip-country` — legacy Vercel header; harmless leftover
 *      from the deploy history. Kept in case a preview deploy ever
 *      goes back to Vercel.
 *   3. `accept-language` — last-resort fallback for direct ALB hits.
 */
function detectCountry(request: NextRequest): string {
  const cf = request.headers.get('cloudfront-viewer-country');
  if (cf) return cf;

  const vercel = request.headers.get('x-vercel-ip-country');
  if (vercel) return vercel;

  const accept = (request.headers.get('accept-language') || '').toLowerCase();
  if (accept.startsWith('ko')) return 'KR';
  if (
    accept.startsWith('en') ||
    accept.startsWith('ja') ||
    accept.startsWith('zh') ||
    accept.startsWith('fr') ||
    accept.startsWith('de') ||
    accept.startsWith('es')
  ) {
    return 'US';
  }
  return 'KR';
}

/**
 * Next.js 16 middleware (registered via the `proxy.ts` filename per the new
 * convention). Runs on every request matched by `config.matcher`.
 *
 * Responsibilities:
 *
 *   1. Country detection — forward `x-user-country` to both request and
 *      response so SSR and client code can branch.
 *   2. Cognito ID-token verification on `/admin/*`.
 *   3. Admin role check via the JWT's `cognito:groups` claim — no DB
 *      round-trip needed; the proxy fails closed on missing/invalid
 *      tokens.
 *   4. Public language routing — bare `/` and legacy `/products/*` get
 *      redirected to the language-prefixed route.
 *
 * History note: the Supabase fallback branch that previously sat here
 * was removed 2026-06-30 once USE_COGNITO=true had been the live mode
 * for ~5 days and the Supabase project was scheduled for deletion.
 * Cognito is now the only auth backend; no env probing needed.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const country = detectCountry(request);

  // Forward `x-user-country` to downstream handlers via request headers
  // (Server Components read it through `headers()`). The same value is
  // mirrored onto every response we return so client JS can also read it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-country', country);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-user-country', country);

  const { pathname } = request.nextUrl;

  // ---- /admin/* gate ----------------------------------------------------
  if (pathname.startsWith('/admin')) {
    const idToken = request.cookies.get('cognito_id_token')?.value;
    if (!idToken) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    const { verifyCognitoIdToken, isAdminFromCognito } =
      await import('@/lib/auth/cognito');
    const claims = await verifyCognitoIdToken(idToken);
    if (!claims) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
      const redirect = NextResponse.redirect(loginUrl);
      // Clear the stale cookie so the browser doesn't keep retrying
      // with an expired/invalid token on every navigation.
      redirect.cookies.delete('cognito_id_token');
      return redirect;
    }
    if (!isAdminFromCognito(claims)) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    return response;
  }

  // ---- Auth pages — let through unchanged -------------------------------
  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return response;
  }

  // ---- Public language routing ------------------------------------------
  return routeLanguageOnly(request, response, country);
}

/**
 * Public-route language redirects. Extracted so we can call it from the
 * "Supabase env missing" early-return path without duplicating logic.
 */
function routeLanguageOnly(
  request: NextRequest,
  response: NextResponse,
  country: string
): NextResponse {
  const { pathname } = request.nextUrl;
  const defaultLang: ValidLang = country === 'KR' ? 'kr' : 'en';

  const firstSeg = pathname.split('/')[1] as ValidLang | string;
  if ((VALID_LANGS as readonly string[]).includes(firstSeg)) {
    return response;
  }

  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLang}`, request.url));
  }

  if (pathname.startsWith('/products')) {
    const rest = pathname.replace('/products', '');
    return NextResponse.redirect(
      new URL(
        `/${defaultLang}/products${rest}${request.nextUrl.search}`,
        request.url
      )
    );
  }

  return response;
}

export const config = {
  /*
   * Run on everything except:
   *   - /api routes (each handles its own auth)
   *   - Next.js static assets + image optimizer output
   *   - SEO files at the root
   *
   * /admin is intentionally NOT excluded — that's the whole point of this
   * middleware. Keep it inside the catch-all so the auth gate runs.
   */
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
