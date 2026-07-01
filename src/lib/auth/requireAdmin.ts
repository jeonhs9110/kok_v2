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

/**
 * Read the caller's Cognito sub (userId) without enforcing any role —
 * used by routes that already passed requireSuperAdmin and need to
 * cross-check the target id against the caller for self-mutation
 * prevention. Returns null when the cookie / claims are absent.
 */
export async function getCallerUserId(): Promise<string | null> {
  if (process.env.USE_COGNITO !== 'true') return null;
  try {
    const jar = await cookies();
    const idToken = jar.get('cognito_id_token')?.value;
    if (!idToken) return null;
    const { verifyCognitoIdToken } = await import('./cognito');
    const claims = await verifyCognitoIdToken(idToken);
    if (!claims) return null;
    const sub = (claims as { sub?: unknown }).sub;
    return typeof sub === 'string' && sub.length > 0 ? sub : null;
  } catch (err) {
    console.error('[getCallerUserId] unexpected error:', err);
    return null;
  }
}

/**
 * Reusable gate for super-admin-only API routes (role mutation,
 * customer deletion, audit-log read, etc.). Returns null on pass,
 * a 401/403 NextResponse otherwise.
 *
 * Only Cognito-backed pools carry the super-admin group; the legacy
 * Supabase fallback path treats role='admin' as the highest privilege
 * (no super-admin concept) and returns 403 to keep the privilege
 * boundary honest in case the cutover is rolled back.
 */
export async function requireSuperAdmin(): Promise<NextResponse | null> {
  if (process.env.USE_COGNITO !== 'true') {
    return NextResponse.json({ error: 'super_admin requires cognito' }, { status: 403 });
  }
  try {
    const jar = await cookies();
    const idToken = jar.get('cognito_id_token')?.value;
    if (!idToken) {
      logAdminDenial({ reason: 'no_cookie', variant: 'super_admin' });
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    const { verifyCognitoIdToken, isSuperAdminFromCognito } = await import('./cognito');
    const claims = await verifyCognitoIdToken(idToken);
    if (!claims) {
      logAdminDenial({ reason: 'invalid_token', variant: 'super_admin' });
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    if (!isSuperAdminFromCognito(claims)) {
      logAdminDenial({ reason: 'forbidden', variant: 'super_admin', actor: claims.sub ?? null });
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return null;
  } catch (err) {
    console.error('[requireSuperAdmin] unexpected error:', err);
    logAdminDenial({ reason: 'exception', variant: 'super_admin' });
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
}

async function requireAdminCognito(): Promise<NextResponse | null> {
  try {
    const jar = await cookies();
    const idToken = jar.get('cognito_id_token')?.value;
    if (!idToken) {
      logAdminDenial({ reason: 'no_cookie', variant: 'admin' });
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    const { verifyCognitoIdToken, isAdminFromCognito } = await import('./cognito');
    const claims = await verifyCognitoIdToken(idToken);
    if (!claims) {
      logAdminDenial({ reason: 'invalid_token', variant: 'admin' });
      return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
    }
    if (!isAdminFromCognito(claims)) {
      logAdminDenial({ reason: 'forbidden', variant: 'admin', actor: claims.sub ?? null });
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
    return null;
  } catch (err) {
    console.error('[requireAdmin/cognito] unexpected error:', err);
    logAdminDenial({ reason: 'exception', variant: 'admin' });
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }
}

/**
 * Structured denial log — CloudWatch metric filter keys on
 * `event=admin.denied` so Dynamic Solution can alarm on burst
 * (bot fuzzing /api/admin/*). Prior code returned 401/403 silently
 * with no server-side breadcrumb; no forensic surface after a
 * "someone tried to break into /admin" report.
 */
function logAdminDenial(fields: {
  reason: 'no_cookie' | 'invalid_token' | 'forbidden' | 'exception';
  variant: 'admin' | 'super_admin';
  actor?: string | null;
}): void {
  try {
    console.warn(JSON.stringify({
      event: 'admin.denied',
      ...fields,
    }));
  } catch { /* never let logging break auth */ }
}

async function requireAdminSupabase(): Promise<NextResponse | null> {
  try {
    const supabase = await getSupabaseServer();
    if (!supabase) {
      // Supabase env unset — refuse admin access via this branch. Prod
      // uses requireAdminCognito anyway (USE_COGNITO=true).
      return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    }
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
