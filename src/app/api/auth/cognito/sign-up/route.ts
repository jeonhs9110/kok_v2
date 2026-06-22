import { NextResponse } from 'next/server';

/**
 * POST /api/auth/cognito/sign-up
 *
 * Body: { email, password }
 * Returns: { ok, codeDeliveryDetails }
 *
 * Cognito sends a verification code to the email; the client then
 * calls /api/auth/cognito/confirm with the code.
 */
export async function POST(request: Request) {
  let body: { email?: unknown; password?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const password = typeof body.password === 'string' ? body.password : '';
  if (!email || !password) {
    return NextResponse.json({ error: 'email_and_password_required' }, { status: 400 });
  }
  // Match cognito.tf password policy. Server-side check so a custom
  // client form can't bypass the rules and trigger an opaque Cognito
  // error.
  if (password.length < 8 || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  }

  const { signUpWithCognito } = await import('@/lib/auth/cognito-server');
  const result = await signUpWithCognito(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: 'sign_up_failed' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, codeDeliveryDetails: result.codeDeliveryDetails });
}
