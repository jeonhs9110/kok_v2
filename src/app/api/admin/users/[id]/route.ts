import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireSuperAdmin, getCallerUserId } from '@/lib/auth/requireAdmin';

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

  // Self-protection: a super-admin must not be able to demote themselves.
  // The UI disables the button on the caller's own row, but enforce it
  // server-side too — a malicious or scripted PATCH would otherwise
  // lock the operator out of /admin with no recovery path.
  const callerId = await getCallerUserId();
  if (callerId && callerId === id) {
    return NextResponse.json(
      { ok: false, error: 'cannot mutate own role; ask another super-admin' },
      { status: 409 },
    );
  }

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
      // Mirror the role change into Cognito group membership. The gate at
      // sign-in checks the JWT claim, not the RDS row, so a failed mirror
      // means the user can't actually reach /admin even though the
      // database says they're admin. Surface the failure so the operator
      // sees it instead of having to debug a 403 later.
      let cognitoWarning: { message: string; cli: string } | null = null;
      if (email && process.env.USE_COGNITO === 'true') {
        try {
          const { addUserToGroup, removeUserFromGroup } = await import('@/lib/auth/cognito-admin');
          const cognitoOk = role === 'admin'
            ? await addUserToGroup(email, 'admins')
            : await removeUserFromGroup(email, 'admins');
          if (!cognitoOk) {
            const verb = role === 'admin' ? 'admin-add-user-to-group' : 'admin-remove-user-from-group';
            cognitoWarning = {
              message: `RDS 권한은 변경되었지만 Cognito 그룹 동기화에 실패했습니다. 이 사용자는 다음 로그인 시 /admin에 접근할 수 없습니다.`,
              cli: `aws cognito-idp ${verb} --user-pool-id ${process.env.COGNITO_USER_POOL_ID ?? ''} --username "${email}" --group-name admins --region ${process.env.AWS_REGION ?? 'ap-northeast-2'}`,
            };
          }
        } catch (err) {
          console.error('[admin/users] cognito group sync threw:', err);
          cognitoWarning = {
            message: 'Cognito 그룹 동기화 중 오류가 발생했습니다.',
            cli: '',
          };
        }
      }
      return NextResponse.json({ ok, cognitoWarning });
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

  // Self-protection: refuse self-deletion. Same reasoning as PATCH.
  const callerId = await getCallerUserId();
  if (callerId && callerId === id) {
    return NextResponse.json(
      { ok: false, error: 'cannot delete own account; ask another super-admin' },
      { status: 409 },
    );
  }

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
      // Pass email so comments + product_reviews authored under the
      // customer's email (no FK to user_id available) get anonymized
      // too — see deleteUserInPg's doc for the full anonymize-then-
      // delete shape.
      dbOk = await deleteUserInPg(id, email);
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

  let cognitoWarning: { message: string; cli: string } | null = null;
  if (email && process.env.USE_COGNITO === 'true') {
    try {
      const { deleteCognitoUserByEmail } = await import('@/lib/auth/cognito-admin');
      const cognitoOk = await deleteCognitoUserByEmail(email);
      if (!cognitoOk) {
        cognitoWarning = {
          message:
            'RDS 행은 삭제됐지만 Cognito 계정 삭제에 실패했습니다. 이 이메일로 다시 회원가입을 시도하면 "이미 존재하는 사용자" 오류가 납니다.',
          cli: `aws cognito-idp admin-delete-user --user-pool-id ${process.env.COGNITO_USER_POOL_ID ?? ''} --username "${email}" --region ${process.env.AWS_REGION ?? 'ap-northeast-2'}`,
        };
      }
    } catch (err) {
      console.error('[admin/users] cognito delete failed (non-fatal):', err);
      cognitoWarning = {
        message: 'Cognito 계정 삭제 중 오류가 발생했습니다.',
        cli: '',
      };
    }
  }

  return NextResponse.json({ ok: dbOk, cognitoWarning });
}
