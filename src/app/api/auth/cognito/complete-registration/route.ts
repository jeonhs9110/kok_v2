import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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
    await pool.query(
      `INSERT INTO public.customer_profiles (
          id, email, name, phone, gender, birthday, age_range, country,
          skin_type, marketing_consent, privacy_consent, auth_provider,
          custom_fields, created_at, updated_at
        )
        VALUES (
          $1, $2, $3, $4, $5, $6::date, $7, $8,
          $9, $10, $11, 'email',
          COALESCE($12::jsonb, '{}'::jsonb), NOW(), NOW()
        )
        ON CONFLICT (id) DO UPDATE
          SET email             = EXCLUDED.email,
              name              = EXCLUDED.name,
              phone             = EXCLUDED.phone,
              gender            = EXCLUDED.gender,
              birthday          = EXCLUDED.birthday,
              age_range         = EXCLUDED.age_range,
              country           = EXCLUDED.country,
              skin_type         = EXCLUDED.skin_type,
              marketing_consent = EXCLUDED.marketing_consent,
              privacy_consent   = EXCLUDED.privacy_consent,
              custom_fields     = EXCLUDED.custom_fields,
              updated_at        = NOW()`,
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
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/auth/cognito/complete-registration] failed:', err);
    return NextResponse.json({ error: 'profile_save_failed' }, { status: 500 });
  }
}
