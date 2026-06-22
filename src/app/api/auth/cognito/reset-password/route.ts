import { NextResponse } from 'next/server';

/**
 * POST /api/auth/cognito/reset-password
 *
 * Body: { email, code, newPassword }
 * Returns: { ok: boolean }
 *
 * Completes the forgot-password flow by accepting the emailed
 * recovery code along with the new password. Same cognito.tf
 * password policy enforced server-side.
 */
export async function POST(request: Request) {
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
  if (newPassword.length < 8 || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
    return NextResponse.json({ error: 'weak_password' }, { status: 400 });
  }
  const { resetPasswordWithCognito } = await import('@/lib/auth/cognito-server');
  const ok = await resetPasswordWithCognito(email, code, newPassword);
  if (!ok) return NextResponse.json({ error: 'reset_failed' }, { status: 400 });
  return NextResponse.json({ ok: true });
}
