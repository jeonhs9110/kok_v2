import { NextResponse } from 'next/server';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';
import { assertSameOrigin } from '@/lib/http/csrf';

/**
 * POST /api/auth/cognito/resend-code
 *
 * Body: { email }
 * Returns: { ok: true }
 *
 * Re-sends the 6-digit sign-up verification code. Always returns 200 so
 * the UI can't be used to enumerate registered emails — the upstream
 * helper swallows UserNotFound for the same reason.
 *
 * Rate limit: 5 resends per IP per hour. Cognito throttles per-pool,
 * which doesn't stop someone flooding a specific user's inbox with
 * resend emails. Per-IP closes that gap.
 */

const resendCodeLimiter = createRateLimiter({
  name: 'cognito_resend_code',
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

export async function POST(request: Request) {
  const csrf = assertSameOrigin(request);
  if (csrf) return csrf;
  if (!resendCodeLimiter.check(getRequestIp(request))) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

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
