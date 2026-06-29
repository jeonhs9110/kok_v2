import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomer } from '@/lib/auth/requireCustomer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Email is intentionally NOT in this list. The MyPage UI sends it for
// convenience (round-trips userEmail from /api/customer/me) but accepting
// it here would let a malicious client PATCH a fake address into the
// profile row while their Cognito identity stays the original — auth
// would still work via the old email, but /admin/users + the customer's
// own profile display would show the spoofed one, desyncing the two
// permanently. Email is owned by Cognito; we never write it from this
// route. The UI's email-display reads from /api/customer/me's JWT-derived
// value, not from customer_profiles.email, so the UX is unaffected.
const ALLOWED_FIELDS = [
  'name', 'phone', 'gender', 'birthday', 'country', 'skin_type',
  'marketing_consent',
] as const;

/**
 * GET /api/customer/profile → the signed-in customer's profile row.
 */
export async function GET() {
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const { rows } = await pool.query(
        `SELECT * FROM public.customer_profiles WHERE id = $1 LIMIT 1`,
        [auth.userId],
      );
      return NextResponse.json({ profile: rows[0] ?? null });
    } catch (err) {
      console.error('[customer/profile] pg read failed:', err);
      return NextResponse.json({ profile: null }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ profile: null }, { status: 500 });
  const { data } = await supabase.from('customer_profiles').select('*').eq('id', auth.userId).maybeSingle();
  return NextResponse.json({ profile: data ?? null });
}

/**
 * PATCH /api/customer/profile { display_name?, phone?, address_kr?, birth_year? }
 * Upserts allow-listed columns on the customer's own row.
 */
export async function PATCH(req: Request) {
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const payload = body as Record<string, unknown>;

  const fields: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in payload) fields[k] = payload[k];
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ ok: false, error: 'no allowed fields' }, { status: 400 });
  }

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const cols = Object.keys(fields);
      const placeholders = cols.map((_, i) => `$${i + 2}`).join(', ');
      const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
      const values = cols.map(c => fields[c]);
      // 2026-06-29 (PR #318 follow-up): self-heal public.users in case
      // complete-registration was never called or failed (network blip,
      // double-back during the form, etc). PR #318 fixed the canonical
      // path; this is the defense-in-depth for the customer who has a
      // valid Cognito identity + maybe a stale customer_profiles row
      // but no users row, and is now editing their profile from MyPage.
      // Without this, the admin /admin/users list still wouldn't see
      // them even after they actively used the site.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          `INSERT INTO public.users (id, email, role, is_verified, created_at)
             VALUES ($1, $2, 'user', true, NOW())
             ON CONFLICT (id) DO UPDATE
               SET email = COALESCE(EXCLUDED.email, public.users.email)`,
          [auth.userId, auth.email ?? null],
        );
        await client.query(
          `INSERT INTO public.customer_profiles (id, ${cols.join(', ')})
             VALUES ($1, ${placeholders})
             ON CONFLICT (id) DO UPDATE SET ${sets}`,
          [auth.userId, ...values],
        );
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => { /* connection may be gone */ });
        throw err;
      } finally {
        client.release();
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[customer/profile] pg upsert failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('customer_profiles').upsert({ id: auth.userId, ...fields });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/customer/profile — customer-initiated account deletion.
 * Removes the profile row AND the auth identity. Cognito cleanup is
 * best-effort: if it fails (IAM not granted on the EC2 role yet) the
 * profile row still goes and the operator can finish the Cognito side
 * via /admin/users. The customer's email is freed up for re-register
 * only after the Cognito identity is gone.
 */
export async function DELETE() {
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  let dbOk = false;
  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      await pool.query(`DELETE FROM public.customer_profiles WHERE id = $1`, [auth.userId]);
      await pool.query(`DELETE FROM public.wishlist WHERE user_id = $1`, [auth.userId]).catch(() => {});
      await pool.query(`DELETE FROM public.users WHERE id = $1`, [auth.userId]).catch(() => {});
      dbOk = true;
    } catch (err) {
      console.error('[customer/profile] pg delete failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  } else if (supabase) {
    await supabase.from('customer_profiles').delete().eq('id', auth.userId);
    await supabase.from('wishlist').delete().eq('user_id', auth.userId);
    dbOk = true;
  }

  // Best-effort Cognito cleanup. Now succeeds — the EC2 role gained
  // cognito-idp:AdminDeleteUser + ListUsers + AdminGetUser on 2026-06-29
  // (권대영's grant, verified via SSM Send-Command). The "best-effort"
  // framing stays because we still want to return ok:true on the DB
  // delete even if Cognito hiccups (e.g., user already removed via the
  // admin UI), so the customer doesn't get stuck with a half-deleted
  // account they can't try again.
  let cognitoCleared = false;
  if (auth.email && process.env.USE_COGNITO === 'true') {
    try {
      const { deleteCognitoUserByEmail } = await import('@/lib/auth/cognito-admin');
      cognitoCleared = await deleteCognitoUserByEmail(auth.email);
    } catch (err) {
      console.error('[customer/profile] cognito cleanup failed (non-fatal):', err);
    }
  }

  return NextResponse.json({ ok: dbOk, cognitoCleared });
}
