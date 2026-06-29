import { NextResponse } from 'next/server';
import { checkPasswordPolicy } from '@/lib/auth/passwordPolicy';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';

/**
 * POST /api/auth/cognito/sign-up
 *
 * Body: { email, password }
 * Returns: { ok, codeDeliveryDetails }
 *
 * Cognito sends a verification code to the email; the client then
 * calls /api/auth/cognito/confirm with the code.
 *
 * Rate limit: 10 sign-ups per IP per hour. Tight enough to stop a
 * scripted flood that would burn through SES sandbox quota / Cognito
 * pool quota; loose enough that a family sharing a NAT can each
 * register without colliding.
 */

const signUpLimiter = createRateLimiter({
  name: 'cognito_sign_up',
  limit: 10,
  windowMs: 60 * 60 * 1000,
});

export async function POST(request: Request) {
  if (!signUpLimiter.check(getRequestIp(request))) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

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
  // Server-side policy check mirrors the client `PasswordChecklist`
  // and infrastructure/cognito.tf. Previously this only enforced
  // length + lowercase + number, so a non-UI client could submit a
  // password missing uppercase or symbol and get an opaque
  // InvalidPassword error back from Cognito instead of the friendly
  // "weak_password" code the form already handles.
  if (!checkPasswordPolicy(password).allValid) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  }

  const { signUpWithCognito } = await import('@/lib/auth/cognito-server');
  const result = await signUpWithCognito(email, password);
  if (!result.ok) {
    return NextResponse.json({ error: 'sign_up_failed' }, { status: 400 });
  }
  return NextResponse.json({ ok: true, codeDeliveryDetails: result.codeDeliveryDetails });
}
