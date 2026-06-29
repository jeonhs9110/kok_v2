import { NextResponse, type NextRequest } from 'next/server';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';

/**
 * POST /api/auth/cognito/sign-in
 *
 * Body: { email, password }
 * Returns: { ok: boolean }
 *
 * On success, sets THREE httpOnly cookies:
 *   - cognito_id_token       (JWT — read by proxy.ts + requireAdmin)
 *   - cognito_access_token   (kept for the eventual GlobalSignOut call)
 *   - cognito_refresh_token  (for the silent refresh flow — D3)
 *
 * httpOnly so no client JS can read or steal them via XSS. Same-site
 * lax so the cookie survives the post-sign-in redirect but does not
 * ride on cross-origin top-level navigations.
 *
 * Rate limit: 10 attempts per IP per 5 minutes. Cognito's pool-wide
 * AdvancedSecurity throttle catches sustained brute force at scale,
 * but a per-IP brake here stops credential stuffing from one source
 * before it reaches Cognito.
 */
const signInLimiter = createRateLimiter({
  name: 'cognito_sign_in',
  limit: 10,
  windowMs: 5 * 60 * 1000,
});

export async function POST(request: NextRequest) {
  if (!signInLimiter.check(getRequestIp(request))) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'email_and_password_required' }, { status: 400 });
  }

  const { signInWithCognito } = await import('@/lib/auth/cognito-server');
  const result = await signInWithCognito(email, password);
  if (!result) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  // Verify the freshly-issued ID token so we can read its claims.
  // Belt-and-suspenders — Cognito would have rejected the credentials
  // upstream — but reading the JWT also tells us whether the user is
  // in the admins group, which the mirror cookie below exposes to the
  // header's client-side state check.
  const { verifyCognitoIdToken, isAdminFromCognito } = await import('@/lib/auth/cognito');
  const claims = await verifyCognitoIdToken(result.idToken);
  const isAdmin = isAdminFromCognito(claims);

  const isProd = process.env.NODE_ENV === 'production';
  const res = NextResponse.json({ ok: true, isAdmin });
  res.cookies.set('cognito_id_token', result.idToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: result.expiresInSeconds,
  });
  res.cookies.set('cognito_access_token', result.accessToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: result.expiresInSeconds,
  });
  res.cookies.set('cognito_refresh_token', result.refreshToken, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days (matches cognito.tf's refresh_token_validity)
  });
  // Non-httpOnly mirror cookies for the storefront header's client-side
  // auth state check (Header.tsx reads document.cookie). httpOnly would
  // break the existing pattern that the Supabase /auth/callback route
  // uses too. The mirror carries no secret — just true/false — and is
  // cleared by the sign-out route.
  res.cookies.set('kokkok_auth', 'true', {
    httpOnly: false,
    sameSite: 'lax',
    secure: isProd,
    path: '/',
    maxAge: result.expiresInSeconds,
  });
  if (isAdmin) {
    res.cookies.set('kokkok_admin_auth', 'true', {
      httpOnly: false,
      sameSite: 'lax',
      secure: isProd,
      path: '/',
      maxAge: result.expiresInSeconds,
    });
  }
  return res;
}
