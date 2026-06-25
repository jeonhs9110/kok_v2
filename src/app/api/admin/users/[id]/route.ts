import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/users/[id]
 * Body: { role: 'admin' | 'user' }
 * Admin-only role toggle for a single user.
 */
export async function PATCH(req: Request, { params }: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }
  const { role } = body as { role?: string };
  if (role !== 'admin' && role !== 'user') {
    return NextResponse.json({ ok: false, error: 'invalid role' }, { status: 400 });
  }

  if (process.env.USE_RDS === 'true') {
    try {
      const { setUserRoleInPg } = await import('@/lib/db/admin-writes');
      const ok = await setUserRoleInPg(id, role);
      return NextResponse.json({ ok });
    } catch (err) {
      console.error('[admin/users] pg role update failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('users').update({ role }).eq('id', id);
  if (error) {
    console.error('[admin/users] supabase role update failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/users/[id]
 * Removes the row from public.users. Cognito identity remains until manually
 * pruned from the user pool (separate Dynamic Solution operational task).
 */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { deleteUserInPg } = await import('@/lib/db/admin-writes');
      const ok = await deleteUserInPg(id);
      return NextResponse.json({ ok });
    } catch (err) {
      console.error('[admin/users] pg delete failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('users').delete().eq('id', id);
  if (error) {
    console.error('[admin/users] supabase delete failed:', error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
