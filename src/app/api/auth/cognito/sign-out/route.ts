import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

/**
 * POST /api/auth/cognito/sign-out
 *
 * Server-side counterpart to the storefront logout button. Calls
 * Cognito GlobalSignOut to invalidate all of the user's tokens
 * (belt-and-suspenders), then clears the three auth cookies so the
 * browser can't reuse them after the redirect.
 */
export async function POST() {
  const jar = await cookies();
  const accessToken = jar.get('cognito_access_token')?.value;

  if (accessToken) {
    const { signOutFromCognito } = await import('@/lib/auth/cognito-server');
    await signOutFromCognito(accessToken);
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.delete('cognito_id_token');
  res.cookies.delete('cognito_access_token');
  res.cookies.delete('cognito_refresh_token');
  res.cookies.delete('kokkok_auth');
  res.cookies.delete('kokkok_admin_auth');
  return res;
}
