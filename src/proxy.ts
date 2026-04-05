import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const VALID_LANGS = ['kr', 'en'];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const vercelCountry = request.headers.get('x-vercel-ip-country');
  const country = vercelCountry || 'KR';
  const defaultLang = country === 'KR' ? 'kr' : 'en';

  const response = NextResponse.next();
  response.headers.set('x-user-country', country);

  // Skip redirect for auth / admin / lang routes
  if (
    pathname.startsWith('/admin') ||
    pathname.startsWith('/login') ||
    pathname.startsWith('/register')
  ) {
    // Admin gating
    if (pathname.startsWith('/admin')) {
      const hasAdminCookie = request.cookies.has('kokkok_admin_auth');
      const hasSupabaseCookie = Array.from(request.cookies.getAll()).some(
        c => c.name.startsWith('sb-') && c.name.endsWith('-auth-token')
      );
      if (!hasAdminCookie && !hasSupabaseCookie) {
        return NextResponse.redirect(new URL('/login', request.url));
      }
    }
    return response;
  }

  // Check if already on a valid lang route
  const firstSeg = pathname.split('/')[1];
  if (VALID_LANGS.includes(firstSeg)) {
    return response;
  }

  // Redirect root
  if (pathname === '/') {
    return NextResponse.redirect(new URL(`/${defaultLang}`, request.url));
  }

  // Redirect old /products/* paths
  if (pathname.startsWith('/products')) {
    const rest = pathname.replace('/products', '');
    return NextResponse.redirect(new URL(`/${defaultLang}/products${rest}${request.nextUrl.search}`, request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
