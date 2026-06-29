import { NextResponse } from 'next/server';
import { checkPasswordPolicy } from '@/lib/auth/passwordPolicy';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';

/**
 * POST /api/auth/cognito/reset-password
 *
 * Body: { email, code, newPassword }
 * Returns: { ok: boolean }
 *
 * Completes the forgot-password flow by accepting the emailed
 * recovery code along with the new password. Same cognito.tf
 * password policy enforced server-side via the shared checker.
 *
 * Rate limit: 10 attempts per IP per hour. Cognito itself locks the
 * code after a few wrong attempts; this prevents an attacker who
 * scraped a leaked email from cycling new codes faster than the user
 * can react.
 */

const resetPasswordLimiter = createRateLimiter({
  name: 'cognito_reset_password',
  limit: 10,
  windowMs: 60 * 60 * 1000,
});

export async function POST(request: Request) {
  if (!resetPasswordLimiter.check(getRequestIp(request))) {
    return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
  }

  let body: { email?: unknown; code?: unknown; newPassword?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const code = typeof body.code === 'string' ? body.code.trim() : '';
  const newPassword = typeof body.newPassword === 'string' ? body.newPassword : '';
  if (!email || !code || !newPassword) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (!checkPasswordPolicy(newPassword).allValid) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  }
  const { resetPasswordWithCognito } = await import('@/lib/auth/cognito-server');
  const ok = await resetPasswordWithCognito(email, code, newPassword);
  if (!ok) return NextResponse.json({ error: 'reset_failed' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
