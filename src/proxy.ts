import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const VALID_LANGS = ['kr', 'en'] as const;
type ValidLang = (typeof VALID_LANGS)[number];

/**
 * Visitor country detection.
 *
 * AWS ALB does not inject a country header by default, so on AWS direct
 * traffic we fall through to Accept-Language. If we ever front the ALB
 * with CloudFront, `cloudfront-viewer-country` will start populating and
 * give us a true IP-based answer for free.
 */
function detectCountry(request: NextRequest): string {
  const vercel = request.headers.get('x-vercel-ip-country');
  if (vercel) return vercel;

  const cf = request.headers.get('cloudfront-viewer-country');
  if (cf) return cf;

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
 *   2. Supabase session refresh + JWT verification via `getUser()`. This
 *      is the critical security upgrade from the previous middleware,
 *      which trusted a plain `kokkok_admin_auth=true` cookie that any
 *      visitor could forge with `document.cookie = ...` in devtools.
 *   3. `/admin/*` gating: must be (a) authenticated, AND (b) have
 *      `users.role === 'admin'` in the database. Both checks happen in
 *      the middleware so unauthorized requests never reach an admin
 *      page's render.
 *   4. Public language routing — bare `/` and legacy `/products/*` get
 *      redirected to the language-prefixed route.
 *
 * Granting admin access (run from the Supabase SQL editor as the service
 * role — anon cannot perform this update):
 *
 *   UPDATE public.users
 *      SET role = 'admin'
 *    WHERE id = (
 *      SELECT id FROM auth.users WHERE email = 'operator@example.com'
 *    );
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  const country = detectCountry(request);

  // Forward `x-user-country` to downstream handlers via request headers
  // (Server Components read it through `headers()`). The same value is
  // mirrored onto every response we return so client JS can also read it.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-user-country', country);

  // Phase D — Cognito-backed auth path. Activated by USE_COGNITO=true,
  // which Phase F sets at cutover (alongside USE_RDS=true). Until then,
  // the legacy Supabase branch below serves every request.
  if (process.env.USE_COGNITO === 'true') {
    return await proxyWithCognito(request, requestHeaders, country);
  }

  // Initial response. The Supabase cookie setter below may replace this
  // if it needs to refresh the access/refresh token tuple during the
  // upcoming `getUser()` call.
  let response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-user-country', country);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured we can still serve public pages, but the
  // admin area is hard-blocked rather than accidentally allowed through.
  if (!url || !anonKey) {
    if (request.nextUrl.pathname.startsWith('/admin')) {
      console.error('[proxy] Supabase env missing — admin routes blocked');
      return NextResponse.redirect(new URL('/login', request.url));
    }
    return routeLanguageOnly(request, response, country);
  }

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value)
        );
        // Rebuild the response so the refreshed cookies actually ship back
        // to the browser, and re-stamp our country header on the new
        // instance (NextResponse.next() does not preserve custom headers).
        response = NextResponse.next({ request: { headers: requestHeaders } });
        response.headers.set('x-user-country', country);
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options)
        );
      },
    },
  });

  // CRITICAL: getUser() — not getSession(). The former performs a server-
  // side JWT verification round-trip with Supabase. The latter merely
  // decodes the cookie locally and is therefore spoofable.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ---- /admin/* gate ----------------------------------------------------
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('next', pathname + request.nextUrl.search);
      return NextResponse.redirect(loginUrl);
    }

    // Verified user → check role. Single round-trip against `users`.
    // The `users` row is keyed by `id = auth.uid()`; RLS should allow each
    // authenticated user to read their own row, while writes to `role`
    // remain restricted to the service role.
    const { data: profile, error: profileError } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();

    if (profileError) {
      console.error('[proxy] Failed to load admin profile:', profileError);
      // Fail closed — better to lock out a legitimate admin briefly than
      // to let traffic through during a transient DB error.
      return NextResponse.redirect(new URL('/login', request.url));
    }

    if (profile?.role !== 'admin') {
      // Authenticated but not an admin: send home, not back to login (the
      // user is already signed in — bouncing to login would loop).
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
 * Cognito-backed branch of the proxy. Mirrors the Supabase path's
 * /admin gate but verifies a Cognito ID token cookie instead of a
 * Supabase session, and reads the admin role from the JWT's
 * `cognito:groups` claim (set by `infrastructure/cognito.tf`'s
 * `aws_cognito_user_group.admins`) — no DB round-trip needed.
 *
 * Cookie name: `cognito_id_token`. The sign-in / sign-out flows that
 * set/clear this cookie land alongside Phase F's storefront cutover;
 * until then this path is unreachable in production because
 * USE_COGNITO is unset.
 */
async function proxyWithCognito(
  request: NextRequest,
  requestHeaders: Headers,
  country: string,
): Promise<NextResponse> {
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('x-user-country', country);

  const { pathname } = request.nextUrl;

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

  if (pathname.startsWith('/login') || pathname.startsWith('/register')) {
    return response;
  }

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
