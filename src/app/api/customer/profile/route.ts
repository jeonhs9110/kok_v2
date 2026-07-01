import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomer } from '@/lib/auth/requireCustomer';
import { auditLog, hashEmail } from '@/lib/audit/log';
import { assertSameOrigin } from '@/lib/http/csrf';

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

// Round 29: PIPA §3(3) "정확성·최신성" — customer_profiles rows must
// stay parseable + sane. Without server-side format enforcement a
// client could PATCH `birthday: "not your business"`, `country: "korea"`
// (breaking `findCountry()` at render time), or `phone: "call me"` —
// downstream flows that trust the shape (SMS routing, CSV export,
// analytics) then silently degrade. R28's slice() cap only bounded
// the byte count; this is the type check the previous round skipped.
const BIRTHDAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MIN_BIRTH_YEAR = 1900;

/**
 * Normalize + validate a birthday string. Accepts 'YYYY-MM-DD' inside
 * a plausible human range (1900 → today). Returns the ISO string on
 * success, null on reject.
 */
function coerceBirthday(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || v.length === 0) return null;
  if (!BIRTHDAY_RE.test(v)) return undefined;
  const t = Date.parse(v + 'T00:00:00Z');
  if (Number.isNaN(t)) return undefined;
  const d = new Date(t);
  if (d.getUTCFullYear() < MIN_BIRTH_YEAR) return undefined;
  if (t > Date.now()) return undefined;
  return v;
}

/**
 * Canonicalize a phone string to a permissive E.164-ish form:
 * `+<dial><digits>` with any spaces / dashes stripped. Downstream SMS
 * routing (Naver Cloud SENS) requires strict E.164, and rows with
 * ad-hoc separators would otherwise need a data-cleanup pass later.
 * Returns null for empty input, undefined for structurally invalid
 * (so the PATCH can reject rather than persist garbage).
 */
function coercePhone(v: unknown): string | null | undefined {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || v.trim().length === 0) return null;
  const m = v.trim().match(/^\+?(\d{1,4})[\s-]*([\d\s-]{4,20})$/);
  if (!m) return undefined;
  const dial = m[1]!;
  const rest = m[2]!.replace(/[\s-]/g, '');
  const digits = dial + rest;
  if (digits.length < 8 || digits.length > 15) return undefined;
  return '+' + digits;
}

/**
 * Coerce a country code to lowercase alpha-2 + validate against the
 * `COUNTRIES` allowlist. Also accepts the English or Korean name as a
 * back-compat path for rows written before /register + /my-page moved
 * to the code-based picker (e.g. Supabase-era "United States").
 */
async function coerceCountry(v: unknown): Promise<string | null | undefined> {
  if (v === null || v === undefined) return null;
  if (typeof v !== 'string' || v.trim().length === 0) return null;
  const { COUNTRIES } = await import('@/lib/geo/countries');
  const lower = v.trim().toLowerCase();
  if (COUNTRIES.some(c => c.code === lower)) return lower;
  const byName = COUNTRIES.find(c =>
    c.nameEn.toLowerCase() === lower || c.nameKr === v.trim(),
  );
  if (byName) return byName.code;
  return undefined;
}

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
      // Round 29: explicit column list instead of `SELECT *`. The row
      // carries fields the MyPage UI never uses (custom_fields,
      // is_verified, auth_provider, privacy_consent, updated_at) —
      // shipping them to the browser expands the attack surface if a
      // future custom_field ever holds sensitive PII, and defeats
      // /register's post-signup ROLLBACK-on-conflict guard. Fields
      // listed match the MyPage `CustomerProfile` interface exactly.
      const { rows } = await pool.query(
        `SELECT id, email, name, phone, gender, birthday, country,
                skin_type, marketing_consent, created_at
           FROM public.customer_profiles
          WHERE id = $1
          LIMIT 1`,
        [auth.userId],
      );
      return NextResponse.json({ profile: rows[0] ?? null });
    } catch (err) {
      console.error('[customer/profile] pg read failed:', err);
      return NextResponse.json({ profile: null }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ profile: null }, { status: 500 });
  const { data } = await supabase
    .from('customer_profiles')
    .select('id, email, name, phone, gender, birthday, country, skin_type, marketing_consent, created_at')
    .eq('id', auth.userId)
    .maybeSingle();
  return NextResponse.json({ profile: data ?? null });
}

/**
 * PATCH /api/customer/profile { name?, phone?, gender?, birthday?,
 *   country?, skin_type?, marketing_consent? }
 * Upserts the allow-listed columns on the customer's own row.
 *
 * Round 30: docstring was stale — referenced `display_name`,
 * `address_kr`, `birth_year` fields from an earlier iteration
 * that never shipped. `customer_profiles` has no address columns
 * today; shipping-address schema is a phase-2 handoff item.
 */
export async function PATCH(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const payload = body as Record<string, unknown>;

  const fields: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) {
    if (!(k in payload)) continue;
    const v = payload[k];
    // Round 29: format-check the typed fields (birthday / country /
    // phone). A reject here returns 400 rather than the prior
    // silent-truncate. The remaining string fields (name, gender,
    // skin_type) fall through to the size cap because their allowed
    // values are operator-configurable via registration_config —
    // enforcing an enum here would tie the API to a snapshot of that
    // config and break next-week's admin-added skin type.
    if (k === 'birthday') {
      const coerced = coerceBirthday(v);
      if (coerced === undefined) {
        return NextResponse.json({ ok: false, error: 'invalid_birthday' }, { status: 400 });
      }
      fields[k] = coerced;
      continue;
    }
    if (k === 'phone') {
      const coerced = coercePhone(v);
      if (coerced === undefined) {
        return NextResponse.json({ ok: false, error: 'invalid_phone' }, { status: 400 });
      }
      fields[k] = coerced;
      continue;
    }
    if (k === 'country') {
      const coerced = await coerceCountry(v);
      if (coerced === undefined) {
        return NextResponse.json({ ok: false, error: 'invalid_country' }, { status: 400 });
      }
      fields[k] = coerced;
      continue;
    }
    // Enforce per-field caps. Strings get sliced (silently truncated
    // is better UX than 400-ing the form on a stray paste with a
    // trailing newline). Non-string values pass through unchanged —
    // marketing_consent is a boolean. Anything that isn't a string
    // and isn't in FIELD_MAX_LEN falls through.
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
        // Only self-heal the users row when we have an email to
        // insert with — public.users.email is NOT NULL, and a
        // federated Cognito login (e.g. Kakao) whose token lacks
        // the email scope would otherwise 500 the entire PATCH with
        // a 23502 constraint violation and silently lose the
        // customer's profile edit. ON CONFLICT still updates the
        // email in place when the row already exists, so a later
        // token with the claim present will heal.
        if (auth.email) {
          await client.query(
            `INSERT INTO public.users (id, email, role, is_verified, created_at)
               VALUES ($1, $2, 'user', true, NOW())
               ON CONFLICT (id) DO UPDATE
                 SET email = COALESCE(EXCLUDED.email, public.users.email)`,
            [auth.userId, auth.email],
          );
        }
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
      // Round 29: PIPA §29(1) audit trail. DELETE was already logged;
      // PATCH — which mutates the same PII — was invisible. Log the
      // set of field NAMES touched, never the values (would double
      // the PII surface). Downstream forensics on a stolen-cookie
      // scenario can now correlate profile edits with the actor.
      auditLog('customer.profile.updated', {
        actor: auth.userId,
        target: auth.userId,
        outcome: 'success',
        metadata: {
          target_email_hash: hashEmail(auth.email),
          fields: cols.join(','),
          field_count: cols.length,
        },
      });
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[customer/profile] pg upsert failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('customer_profiles').upsert({ id: auth.userId, ...fields });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  auditLog('customer.profile.updated', {
    actor: auth.userId,
    target: auth.userId,
    outcome: 'success',
    metadata: {
      target_email_hash: hashEmail(auth.email),
      fields: Object.keys(fields).join(','),
      field_count: Object.keys(fields).length,
    },
  });
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
export async function DELETE(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
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
        // Orders must persist for accounting compliance, but the FK
        // on orders.user_id has no ON DELETE clause (defaults to NO
        // ACTION). Unlink the customer FK so the parent delete below
        // doesn't trip the constraint AND so the customer's identity
        // is no longer retrievable from the order row (PIPA §21).
        await client.query(`UPDATE public.orders SET user_id = NULL WHERE user_id = $1`, [auth.userId]);
        // Cart is ephemeral — drop it.
        await client.query(`DELETE FROM public.cart_items WHERE user_id = $1`, [auth.userId]);
        // Chatbot leads carry PII (email + name + skin_type + country)
        // collected via the storefront /api/customer/chatbot-leads
        // POST. If the same customer later registered and is now
        // deleting the account, that pre-registration lead row would
        // otherwise survive as orphaned PII — direct PIPA Article 21
        // violation (duty to destroy on revocation of consent). Match
        // by email, which is the only field reliably set on lead
        // capture.
        if (auth.email) {
          await client.query(`DELETE FROM public.chatbot_leads WHERE email = $1`, [auth.email]);
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
      auditLog('customer.account.deleted', {
        actor: auth.userId,
        target: auth.userId,
        outcome: 'failure',
        metadata: {
          target_email_hash: hashEmail(auth.email),
          error: err instanceof Error ? err.message : String(err),
        },
      });
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

  // PIPA trail — customer self-service account close. Emits a single
  // audit line via console.log; queryable via CloudWatch Insights.
  auditLog('customer.account.deleted', {
    actor: auth.userId,
    target: auth.userId,
    outcome: dbOk ? (cognitoCleared ? 'success' : 'partial') : 'failure',
    metadata: {
      target_email_hash: hashEmail(auth.email),
      cognito_cleared: cognitoCleared,
    },
  });
  return NextResponse.json({ ok: dbOk, cognitoCleared });
}
