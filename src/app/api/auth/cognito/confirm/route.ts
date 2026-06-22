import { NextResponse } from 'next/server';

/**
 * POST /api/auth/cognito/confirm
 *
 * Body: { email, code }
 * Returns: { ok: boolean }
 *
 * Completes the sign-up flow by validating the verification code
 * Cognito emailed the user. After this the account can sign in.
 */
export async function POST(request: Request) {
  let body: { email?: unknown; code?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  if (!email || !code) {
    return NextResponse.json({ error: 'email_and_code_required' }, { status: 400 });
  }
  const { confirmSignUpWithCognito } = await import('@/lib/auth/cognito-server');
  const ok = await confirmSignUpWithCognito(email, code);
  if (!ok) return NextResponse.json({ error: 'confirm_failed' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
