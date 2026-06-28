import { NextResponse } from 'next/server';

/**
 * POST /api/auth/cognito/resend-code
 *
 * Body: { email }
 * Returns: { ok: true }
 *
 * Re-sends the 6-digit sign-up verification code. Always returns 200 so
 * the UI can't be used to enumerate registered emails — the upstream
 * helper swallows UserNotFound for the same reason.
 */
export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) {
    return NextResponse.json({ error: 'email_required' }, { status: 400 });
  }
  const { resendConfirmationCodeWithCognito } = await import('@/lib/auth/cognito-server');
  await resendConfirmationCodeWithCognito(email);
  return NextResponse.json({ ok: true });
}
