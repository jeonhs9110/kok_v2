import { cookies } from 'next/headers';
import { NextResponse, type NextRequest } from 'next/server';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';
import { assertSameOrigin } from '@/lib/http/csrf';

/**
 * POST /api/auth/cognito/refresh
 *
 * Mints new ID + access tokens from the customer's still-valid
 * refresh token (30-day). Called by the client's `authedFetch`
 * helper whenever an authed request returns 401 — the helper does
 * ONE retry after refresh succeeds, or bounces to /login if the
 * refresh itself fails.
 *
 * Prior to this route, every customer's session silently died at
 * exactly 1h (the ID-token maxAge) — a customer browsing a product
 * for &gt;1h then tapping "add to wishlist" saw a broken toggle with
 * no explanation. Round 20 audit flagged this as HIGH; Round 22
 * design settled on a per-caller refresh (rather than middleware)
 * so route handlers keep verifying against the fresh cookie via
 * requireCustomer() with no cookie-rewrite gymnastics.
 *
 * Rate limit: 20 per IP per 5 min. Refreshes are legitimate but
 * cheap; the cap stops a refresh loop from a broken client from
 * hammering Cognito.
 */

const refreshLimiter = createRateLimiter({
  name: 'cognito_refresh',
  limit: 20,
  windowMs: 5 * 60 * 1000,
});

export async function POST(request: NextRequest) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  if (!refreshLimiter.check(getRequestIp(request))) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }
  const jar = await cookies();
  const refreshToken = jar.get('cognito_refresh_token')?.value;
  if (!refreshToken) {
    return NextResponse.json({ error: 'no_refresh_token' }, { status: 401 });
  }

  const { refreshWithCognito } = await import('@/lib/auth/cognito-server');
  const result = await refreshWithCognito(refreshToken);
  if (!result) {
    // Refresh token invalid / expired / revoked. Clear the auth
    // cookies so the client stops trying and bounces to /login.
    const dead = NextResponse.json({ error: 'refresh_failed' }, { status: 401 });
    dead.cookies.delete('cognito_id_token');
    dead.cookies.delete('cognito_access_token');
    dead.cookies.delete('cognito_refresh_token');
    dead.cookies.delete('kokkok_auth');
    dead.cookies.delete('kokkok_admin_auth');
    return dead;
  }

  // Re-verify to figure out whether the fresh token still carries
  // the admins-group claim — role can be flipped between issuance
  // via /admin/users, and the mirror cookie needs to reflect the
  // new value.
  const { verifyCognitoIdToken, isAdminFromCognito } = await import('@/lib/auth/cognito');
  const claims = await verifyCognitoIdToken(result.idToken);
  const isAdmin = isAdminFromCognito(claims);

  const isProd = process.env.NODE_ENV === 'production';
  const res = NextResponse.json({ ok: true, isAdmin });
  res.cookies.set('cognito_id_token', result.idToken, {
    httpOnly: true, sameSite: 'lax', secure: isProd, path: '/',
    maxAge: result.expiresInSeconds,
  });
  res.cookies.set('cognito_access_token', result.accessToken, {
    httpOnly: true, sameSite: 'lax', secure: isProd, path: '/',
    maxAge: result.expiresInSeconds,
  });
  // Rewrite the refresh cookie even without rotation so its 30-day
  // maxAge window slides forward — a customer who's used the site
  // in the last month keeps their session; a customer who's been
  // gone for 30 days re-authenticates.
  res.cookies.set('cognito_refresh_token', result.refreshToken, {
    httpOnly: true, sameSite: 'lax', secure: isProd,
    // Round 31: match sign-in's `path: '/'`. Two different paths
    // for the same cookie name (sign-in set /, refresh set
    // /api/auth/cognito) meant the browser stored BOTH cookies —
    // on every sliding refresh the path=/ variant grew stale but
    // stuck around for 30 days, and sign-out (which clears path=/)
    // never wiped the path-scoped copy, leaving credential material
    // in the browser after logout. Also R28 flagged that Kakao /
    // Instagram in-app WebViews filter path-scoped cookies, so
    // narrowing this cookie's path silently broke refresh in-app.
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
  res.cookies.set('kokkok_auth', 'true', {
    httpOnly: false, sameSite: 'lax', secure: isProd, path: '/',
    maxAge: result.expiresInSeconds,
  });
  if (isAdmin) {
    res.cookies.set('kokkok_admin_auth', 'true', {
      httpOnly: false, sameSite: 'lax', secure: isProd, path: '/',
      maxAge: result.expiresInSeconds,
    });
  } else {
    // Was admin, now demoted. Clear the mirror.
    res.cookies.delete('kokkok_admin_auth');
  }
  return res;
}
