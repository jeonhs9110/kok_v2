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

// Per-field length caps so a malicious client can't submit a 10MB
// `name` field and bloat the customer_profiles row. The `text` columns
// in the schema have no PG-side limit; without these caps the only
// brake was the rate limit on requireCustomer'd routes, which is fine
// against a flood but not against a single big payload. Numbers are
// generous — long enough for any plausible real value, short enough
// that the row stays bounded.
const FIELD_MAX_LEN: Record<string, number> = {
  name: 100,
  phone: 30,
  gender: 30,
  birthday: 20,  // 'YYYY-MM-DD' fits comfortably
  country: 60,
  skin_type: 40,
};

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
    if (!(k in payload)) continue;
    const v = payload[k];
    // Enforce per-field caps. Strings get sliced (silently truncated
    // is better UX than 400-ing the form on a stray paste with a
    // trailing newline). Non-string values pass through unchanged —
    // marketing_consent is a boolean, birthday may be null. Anything
    // that isn't a string and isn't in FIELD_MAX_LEN falls through.
    const cap = FIELD_MAX_LEN[k];
    if (cap !== undefined && typeof v === 'string') {
      fields[k] = v.slice(0, cap);
    } else {
      fields[k] = v;
    }
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

  // PIPA §21 (개인정보 파기 의무) requires destruction of personal info
  // on account close. We had three classes of customer-authored content
  // that the previous DELETE didn't touch:
  //
  //   - posts (community board)  → author_name + author_id are PII
  //   - comments                 → author_name is PII (no author_id col)
  //   - product_reviews          → author_name is PII (no author_id col)
  //
  // Naive cascade-delete would destroy community discussion that other
  // customers contributed to ("I agree with X" stops making sense when
  // X's post is gone). So we anonymize instead — replace author_name
  // with the Cafe24-style "탈퇴회원" placeholder and null out author_id
  // on posts. The content stays, the PII goes. Standard Korean-ecom
  // practice + audit-trail-friendly.
  //
  // All of this runs in a single transaction with the row deletions
  // below so partial state on failure rolls back cleanly — better to
  // re-try the whole delete than to leave PII anonymized in some
  // tables but still present in others.
  const ANON_NAME = '탈퇴회원';
  let dbOk = false;
  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        // Anonymize authored content first so a failure on the delete
        // doesn't leave the PII rewrite half-done.
        await client.query(
          `UPDATE public.posts SET author_name = $2, author_id = NULL
             WHERE author_id = $1`,
          [auth.userId, ANON_NAME],
        );
        if (auth.email) {
          // comments + reviews don't carry author_id; they're matched by
          // the customer's email (which the customer/comments POST stored
          // as author_name when they didn't type a display name). Only
          // rows that match the customer's exact email are touched —
          // this is conservative; a custom display name like "Sarah"
          // can't be tied back to a specific Cognito sub, so we leave
          // those alone rather than risk anonymizing someone else's
          // contributions.
          await client.query(
            `UPDATE public.comments SET author_name = $2
               WHERE author_name = $1`,
            [auth.email, ANON_NAME],
          );
          await client.query(
            `UPDATE public.product_reviews SET author_name = $2
               WHERE author_name = $1`,
            [auth.email, ANON_NAME],
          );
        }
        // Now the row deletions.
        await client.query(`DELETE FROM public.customer_profiles WHERE id = $1`, [auth.userId]);
        await client.query(`DELETE FROM public.wishlist WHERE user_id = $1`, [auth.userId]);
        await client.query(`DELETE FROM public.users WHERE id = $1`, [auth.userId]);
        await client.query('COMMIT');
        dbOk = true;
      } catch (err) {
        await client.query('ROLLBACK').catch(() => { /* connection may be gone */ });
        throw err;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[customer/profile] pg delete failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  } else if (supabase) {
    // Supabase fallback (dev only). Mirrors the same anonymize-then-
    // delete shape, just without the transaction wrapper since the
    // Supabase JS client doesn't expose one and the dev box isn't the
    // source of truth.
    await supabase.from('posts').update({ author_name: ANON_NAME, author_id: null }).eq('author_id', auth.userId);
    if (auth.email) {
      await supabase.from('comments').update({ author_name: ANON_NAME }).eq('author_name', auth.email);
      await supabase.from('product_reviews').update({ author_name: ANON_NAME }).eq('author_name', auth.email);
    }
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
