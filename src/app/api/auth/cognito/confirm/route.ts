import { NextResponse, type NextRequest } from 'next/server';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';

/**
 * POST /api/auth/cognito/confirm
 *
 * Body: { email, code }
 * Returns: { ok: boolean }
 *
 * Completes the sign-up flow by validating the verification code
 * Cognito emailed the user. After this the account can sign in.
 *
 * Rate limit: 10 attempts per IP per hour. The verification code is
 * 6 digits = 1 in 10^6 random guesses per attempt; without a brake,
 * a scripted caller could brute force the space against any known
 * email in ~50k seconds. The limiter stops a single source long
 * before that becomes feasible.
 */
const confirmLimiter = createRateLimiter({
  name: 'cognito_confirm',
  limit: 10,
  windowMs: 60 * 60 * 1000,
});

export async function POST(request: NextRequest) {
  if (!confirmLimiter.check(getRequestIp(request))) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }
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
