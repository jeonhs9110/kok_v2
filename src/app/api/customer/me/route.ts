import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/auth/requireCustomer';

/**
 * GET /api/customer/me → { userId, email, createdAt? }
 * Lightweight "who is signed in" probe for client pages that need to
 * decide whether to render an authed view. Wraps requireCustomer().
 *
 * createdAt is best-effort — it's only present when the auth provider
 * surfaces it, which it currently doesn't for Cognito (the iat claim is
 * token-issue time, not account-creation time). Customers asking
 * "when did I join" can read it from public.users.created_at via the
 * profile endpoint if needed.
 */
export async function GET() {
  const auth = await requireCustomer();
  if (auth instanceof Response) return auth;

  // Tell the client which role buckets the caller is in so the UI can
  // hide privileged controls. The actual access checks happen
  // server-side on each mutating route — this is display-only.
  let isAdmin = false;
  let isSuperAdmin = false;
  if (process.env.USE_COGNITO === 'true') {
    try {
      const { cookies } = await import('next/headers');
      const jar = await cookies();
      const token = jar.get('cognito_id_token')?.value;
      if (token) {
        const { verifyCognitoIdToken, isAdminFromCognito, isSuperAdminFromCognito } = await import('@/lib/auth/cognito');
        const claims = await verifyCognitoIdToken(token);
        isAdmin = isAdminFromCognito(claims);
        isSuperAdmin = isSuperAdminFromCognito(claims);
      }
    } catch { /* leave false */ }
  }

  return NextResponse.json({
    userId: auth.userId,
    email: auth.email ?? null,
    isAdmin,
    isSuperAdmin,
  });
}
