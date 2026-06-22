import { NextResponse } from 'next/server';

/**
 * POST /api/auth/cognito/forgot-password
 *
 * Body: { email }
 * Returns: { ok: true } — always, to prevent email enumeration.
 *
 * Triggers Cognito to email a recovery code. Whether the email is
 * actually registered or not, the response is the same shape so a
 * malicious caller can't probe the user pool for valid addresses.
 */
export async function POST(request: Request) {
  let body: { email?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!email) return NextResponse.json({ error: 'email_required' }, { status: 400 });

  const { forgotPasswordWithCognito } = await import('@/lib/auth/cognito-server');
  await forgotPasswordWithCognito(email);
  return NextResponse.json({ ok: true });
}
