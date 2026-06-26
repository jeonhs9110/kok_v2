import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSuperAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/admin/users/[id]
 * Body: { role: 'admin' | 'user' }
 * Super-admin-only role toggle. Also flips Cognito group membership so
 * the privilege boundary in the JWT matches the DB row. Race-safe by
 * design — RDS is the source of truth and Cognito the auth gate, so if
 * one side fails the operator notices on next sign-in and re-runs.
 */
export async function PATCH(req: Request, { params }: RouteContext) {
  const denied = await requireSuperAdmin();
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

  // Look up the email up-front so we can flip Cognito groups after.
  let email: string | null = null;
  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const r = await pool.query<{ email: string }>(`SELECT email FROM public.users WHERE id = $1`, [id]);
      email = r.rows[0]?.email ?? null;
    } catch { /* fall through */ }
  } else if (supabase) {
    const { data } = await supabase.from('users').select('email').eq('id', id).maybeSingle();
    email = (data?.email as string | undefined) ?? null;
  }

  if (process.env.USE_RDS === 'true') {
    try {
      const { setUserRoleInPg } = await import('@/lib/db/admin-writes');
      const ok = await setUserRoleInPg(id, role);
      // Mirror the role change into Cognito group membership. Best-effort:
      // if Cognito errors we still persist the RDS row — the gate at sign
      // in checks Cognito groups so the operator will notice on next login
      // and can re-run.
      if (email && process.env.USE_COGNITO === 'true') {
        const { addUserToGroup, removeUserFromGroup } = await import('@/lib/auth/cognito-admin');
        if (role === 'admin') await addUserToGroup(email, 'admins');
        else await removeUserFromGroup(email, 'admins');
      }
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
 * Removes the row from public.users AND the Cognito identity. Both
 * happen best-effort; the DB row is the source of truth so the route
 * returns 200 as soon as that succeeds even if Cognito-side deletion
 * fails (operator can re-run via aws cognito-idp admin-delete-user).
 */
export async function DELETE(_req: Request, { params }: RouteContext) {
  const denied = await requireSuperAdmin();
  if (denied) return denied;

  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  // Look up email first so we can delete the Cognito identity after.
  let email: string | null = null;
  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const r = await pool.query<{ email: string }>(`SELECT email FROM public.users WHERE id = $1`, [id]);
      email = r.rows[0]?.email ?? null;
    } catch { /* fall through */ }
  } else if (supabase) {
    const { data } = await supabase.from('users').select('email').eq('id', id).maybeSingle();
    email = (data?.email as string | undefined) ?? null;
  }

  let dbOk = false;
  if (process.env.USE_RDS === 'true') {
    try {
      const { deleteUserInPg } = await import('@/lib/db/admin-writes');
      dbOk = await deleteUserInPg(id);
    } catch (err) {
      console.error('[admin/users] pg delete failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  } else if (supabase) {
    const { error } = await supabase.from('users').delete().eq('id', id);
    if (error) {
      console.error('[admin/users] supabase delete failed:', error);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
    dbOk = true;
  }

  if (email && process.env.USE_COGNITO === 'true') {
    try {
      const { deleteCognitoUserByEmail } = await import('@/lib/auth/cognito-admin');
      await deleteCognitoUserByEmail(email);
    } catch (err) {
      console.error('[admin/users] cognito delete failed (non-fatal):', err);
    }
  }

  return NextResponse.json({ ok: dbOk });
}
