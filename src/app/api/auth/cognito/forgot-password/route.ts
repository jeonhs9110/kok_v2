import { NextResponse } from 'next/server';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';
import { assertSameOrigin } from '@/lib/http/csrf';

/**
 * POST /api/auth/cognito/forgot-password
 *
 * Body: { email }
 * Returns: { ok: true } — always, to prevent email enumeration.
 *
 * Triggers Cognito to email a recovery code. Whether the email is
 * actually registered or not, the response is the same shape so a
 * malicious caller can't probe the user pool for valid addresses.
 *
 * Rate limit: 5 recovery requests per IP per hour. Cognito has a
 * pool-level throttle but it doesn't stop a targeted email-bombing
 * attack against a single victim (1000 recovery emails to one
 * address). Per-IP brake closes that gap without affecting a real
 * user who legitimately forgot their password.
 */

const forgotPasswordLimiter = createRateLimiter({
  name: 'cognito_forgot_password',
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  if (!forgotPasswordLimiter.check(getRequestIp(request))) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

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
