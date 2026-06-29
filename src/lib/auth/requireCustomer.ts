import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Reusable auth gate for customer-only API routes (wishlist, profile,
 * post-write, comment). Returns the user id when the caller is
 * authenticated; returns a NextResponse (401) otherwise.
 *
 * Two paths, mirrors requireAdmin():
 *   - USE_COGNITO=true → verify a Cognito ID-token cookie. The `sub`
 *     claim is the Cognito user id; we look up the public.users row
 *     with the same id to get the app-side uuid.
 *   - default → Supabase getUser() returns the supabase auth user id.
 *
 * Usage:
 *   const auth = await requireCustomer();
 *   if (auth instanceof NextResponse) return auth;
 *   const userId = auth.userId;
 */
export type CustomerAuth = { userId: string; email?: string };

export async function requireCustomer(): Promise<CustomerAuth | NextResponse> {
  if (process.env.USE_COGNITO === 'true') {
    return await requireCustomerCognito();
  }
  return await requireCustomerSupabase();
}

async function requireCustomerCognito(): Promise<CustomerAuth | NextResponse> {
  try {
    const jar = await cookies();
    const idToken = jar.get('cognito_id_token')?.value;
    if (!idToken) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    const { verifyCognitoIdToken } = await import('./cognito');
    const claims = await verifyCognitoIdToken(idToken);
    if (!claims) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    return { userId: claims.sub, email: claims.email };
  } catch (err) {
    console.error('[requireCustomer/cognito] unexpected error:', err);
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
}

async function requireCustomerSupabase(): Promise<CustomerAuth | NextResponse> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    return { userId: user.id, email: user.email };
  } catch (err) {
    console.error('[requireCustomer] unexpected error:', err);
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
}

/**
 * Optional variant of requireCustomer() for routes that need to behave
 * differently for signed-in vs anonymous callers without 401-ing the
 * anonymous case. Returns the CustomerAuth shape when the request
 * carries a valid Cognito ID token; returns null otherwise. Never
 * throws — verification errors fall through to null so a malformed
 * cookie doesn't break a public endpoint.
 */
export async function requireCustomerOptional(): Promise<CustomerAuth | null> {
  try {
    if (process.env.USE_COGNITO === 'true') {
      const jar = await cookies();
      const idToken = jar.get('cognito_id_token')?.value;
      if (!idToken) return null;
      const { verifyCognitoIdToken } = await import('./cognito');
      const claims = await verifyCognitoIdToken(idToken);
      if (!claims) return null;
      return { userId: claims.sub, email: claims.email };
    }
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    return { userId: user.id, email: user.email };
  } catch {
    return null;
  }
}
