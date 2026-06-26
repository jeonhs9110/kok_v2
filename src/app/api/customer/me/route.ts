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
  return NextResponse.json({ userId: auth.userId, email: auth.email ?? null });
}
