import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Reusable auth gate for admin-only API routes.
 *
 * Returns `null` when the caller is an authenticated admin (route handler
 * proceeds normally); returns a NextResponse (401/403) the route handler
 * should `return` immediately when the caller is not authorized.
 *
 * Two paths:
 *   - USE_COGNITO=true → verify a Cognito ID token cookie + check the
 *     `cognito:groups` claim for `admins`. No DB round-trip needed.
 *   - default → Supabase getUser() + users.role === 'admin' check.
 *
 * Both fail closed on unexpected error.
 *
 * Usage:
 *   export async function POST(request: Request) {
 *     const denied = await requireAdmin();
 *     if (denied) return denied;
 *     // … the route's real work …
 *   }
 */
export async function requireAdmin(): Promise<NextResponse | null> {
  if (process.env.USE_COGNITO === 'true') {
    return await requireAdminCognito();
  }
  return await requireAdminSupabase();
}

async function requireAdminCognito(): Promise<NextResponse | null> {
  try {
    const jar = await cookies();
    const idToken = jar.get('cognito_id_token')?.value;
    if (!idToken) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    const { verifyCognitoIdToken, isAdminFromCognito } = await import('./cognito');
    const claims = await verifyCognitoIdToken(idToken);
    if (!claims) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    if (!isAdminFromCognito(claims)) {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return null;
  } catch (err) {
    console.error('[requireAdmin/cognito] unexpected error:', err);
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
}

async function requireAdminSupabase(): Promise<NextResponse | null> {
  try {
    const supabase = await getSupabaseServer();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    const { data: profile, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (error) {
      console.error('[requireAdmin] profile load failed:', error);
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return null;
  } catch (err) {
    console.error('[requireAdmin] unexpected error:', err);
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
}
