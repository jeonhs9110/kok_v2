import { NextResponse } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * Reusable auth gate for admin-only API routes.
 *
 * Returns `null` when the caller is an authenticated admin (route handler
 * proceeds normally); returns a NextResponse (401/403) the route handler
 * should `return` immediately when the caller is not authorized.
 *
 * Pattern matches src/proxy.ts's /admin/* gating: verify the user via
 * getUser() (NOT getSession — getSession trusts the cookie payload), then
 * check users.role === 'admin'. Fails closed on DB error.
 *
 * Usage:
 *   export async function POST(request: Request) {
 *     const denied = await requireAdmin();
 *     if (denied) return denied;
 *     // … the route's real work …
 *   }
 */
export async function requireAdmin(): Promise<NextResponse | null> {
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
