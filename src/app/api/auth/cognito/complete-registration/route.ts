import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';
import { assertSameOrigin } from '@/lib/http/csrf';

/**
 * POST /api/auth/cognito/complete-registration
 *
 * Called once at the end of the Cognito sign-up flow:
 *   1. /api/auth/cognito/sign-up         — Cognito SignUp; email sent
 *   2. /api/auth/cognito/confirm         — Cognito ConfirmSignUp (code)
 *   3. /api/auth/cognito/sign-in         — fresh JWT + cookie
 *   4. /api/auth/cognito/complete-registration  ← this
 *
 * Step 4 reads the cognito_id_token cookie set by sign-in, extracts the
 * sub claim, and upserts the customer_profiles row keyed by that sub.
 * Supabase did this in one shot from signUp's return value; Cognito
 * splits the lifecycle so the row create has to wait for the
 * post-confirmation sign-in.
 *
 * Body shape mirrors RegisterForm's payload (name/phone/gender/etc.)
 * but the route ignores any \`id\` field — the sub from the JWT is
 * the only trusted source.
 */

// Per-IP brake matching the other Cognito mutation endpoints
// (sign-up / reset-password / confirm all cap at 10/hour). Without
// this a token holder could iterate on custom_fields / marketing_
// consent / skin_type churn — cheap per call but abusive in a loop.
const completeLimiter = createRateLimiter({
  name: 'complete-registration',
  limit: 10,
  windowMs: 60 * 60 * 1000,
});

interface RegistrationPayload {
  name?: string | null;
  phone?: string | null;
  gender?: string | null;
  birthday?: string | null;
  age_range?: string | null;
  country?: string | null;
  skin_type?: string | null;
  marketing_consent?: boolean;
  privacy_consent?: boolean;
  custom_fields?: Record<string, string>;
}

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  if (!completeLimiter.check(getRequestIp(request))) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429 },
    );
  }
  const jar = await cookies();
  const idToken = jar.get('cognito_id_token')?.value;
  if (!idToken) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });
  }
  const { verifyCognitoIdToken } = await import('@/lib/auth/cognito');
  const claims = await verifyCognitoIdToken(idToken);
  if (!claims) {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  let body: RegistrationPayload;
  try {
    body = await request.json() as RegistrationPayload;
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  try {
    const { getPgPool } = await import('@/lib/db/pool');
    const pool = getPgPool();
    // Two writes in one logical step:
    //   1. public.users — the admin-facing identity row. Pre-Cognito,
    //      Supabase's auth.users → public.users trigger did this for
    //      free. After the cutover there's no trigger and no equivalent
    //      Lambda hooked into PostConfirmation, so every Cognito sign-up
    //      since 2026-06-27 has been invisible to /admin/users (which
    //      reads only from public.users). Operator literally cannot see
    //      who has signed up. Default role='user' (the schema default).
    //      is_verified=true because by the time we reach this route the
    //      Cognito ConfirmSignUp step has completed — the email IS
    //      verified upstream.
    //   2. public.customer_profiles — the PII-bearing profile row keyed
    //      by the same id (the Cognito sub).
    // Use a single transaction so a customer_profiles failure rolls back
    // the users row too (the inverse — users without profile — is the
    // less dangerous state because storefront flows can still operate
    // off Cognito claims, but consistency matters).
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      // Idempotency guard — the route is a one-shot for a fresh
      // registration. Prior code UPDATE'd customer_profiles on
      // conflict, so a second call (browser back-button, malicious
      // extension re-POSTing) with different / blank / attacker-
      // chosen values would silently wipe the customer's stored
      // PII + consent flags without any confirmation and break the
      // PIPA marketing_consent audit trail. Now if the row already
      // exists we return 409 and route the caller to
      // /api/customer/profile PATCH which is the intended edit
      // surface and IS guarded by requireCustomer.
      const existing = await client.query<{ id: string }>(
        `SELECT id FROM public.customer_profiles WHERE id = $1 LIMIT 1`,
        [claims.sub],
      );
      if (existing.rowCount && existing.rowCount > 0) {
        await client.query('ROLLBACK');
        return NextResponse.json(
          { error: 'already_registered', hint: 'Use /api/customer/profile to edit.' },
          { status: 409 },
        );
      }
      await client.query(
        `INSERT INTO public.users (id, email, role, is_verified, created_at)
           VALUES ($1, $2, 'user', true, NOW())
           ON CONFLICT (id) DO UPDATE
             SET email = EXCLUDED.email,
                 is_verified = EXCLUDED.is_verified`,
        [claims.sub, claims.email ?? null],
      );
      await client.query(
        `INSERT INTO public.customer_profiles (
            id, email, name, phone, gender, birthday, age_range, country,
            skin_type, marketing_consent, privacy_consent, auth_provider,
            custom_fields, created_at, updated_at
          )
          VALUES (
            $1, $2, $3, $4, $5, $6::date, $7, $8,
            $9, $10, $11, 'email',
            COALESCE($12::jsonb, '{}'::jsonb), NOW(), NOW()
          )`,
        [
          claims.sub,
          claims.email ?? null,
          body.name?.trim() || null,
          body.phone?.trim() || null,
          body.gender || null,
          body.birthday || null,
          body.age_range || null,
          body.country?.trim() || null,
          body.skin_type || null,
          body.marketing_consent ?? false,
          body.privacy_consent ?? false,
          body.custom_fields ? JSON.stringify(body.custom_fields) : null,
        ],
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
    console.error('[api/auth/cognito/complete-registration] failed:', err);
    return NextResponse.json({ error: 'profile_save_failed' }, { status: 500 });
  }
}
