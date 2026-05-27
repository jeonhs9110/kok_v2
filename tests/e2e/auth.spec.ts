import { test, expect } from '@playwright/test';

/**
 * Auth gate tests. These guard the security upgrades from Phase 1 + 1.5:
 *
 *   - /admin/* must redirect unauthenticated visitors to /login?next=…
 *   - The legacy `kokkok_admin_auth=true` cookie must NOT bypass the gate
 *     (was the spoofable shortcut that the JWT-verified middleware replaced)
 *   - /forgot-password and /auth/reset-password must be reachable so the
 *     password-reset loop isn't broken
 *
 * No actual login attempts — credentials are environmental and we don't
 * want CI to consume real password-reset tokens.
 */

test.describe('auth gates', () => {
  test('/admin redirects unauth to /login?next=/admin', async ({ page }) => {
    const response = await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    // 307 from the middleware, then the browser follows to /login. The
    // final URL should contain the encoded `next` param.
    expect(response?.status()).toBeLessThan(400);
    expect(page.url()).toMatch(/\/login\?.*next=%2Fadmin/);
  });

  test('spoofed kokkok_admin_auth=true cookie does NOT bypass the gate', async ({ context, page }) => {
    // Plant the legacy cookie the old middleware trusted.
    await context.addCookies([
      {
        name: 'kokkok_admin_auth',
        value: 'true',
        domain: new URL(page.url() || 'http://localhost:3000').hostname || 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    // Same as the unauthenticated case — the cookie has no effect now.
    expect(page.url()).toMatch(/\/login\?.*next=%2Fadmin/);
  });

  test('/login renders the sign-in form with a forgot-password link', async ({ page }) => {
    await page.goto('/login');
    // The form is inside a Suspense boundary (useSearchParams), so we wait
    // for hydration before asserting on the link.
    await expect(page.getByRole('button', { name: /sign in|로그인/i })).toBeVisible();
    await expect(
      page.getByRole('link', { name: /forgot|비밀번호를 잊으셨나요/i })
    ).toHaveAttribute('href', '/forgot-password');
  });

  test('/forgot-password renders the email input', async ({ page }) => {
    await page.goto('/forgot-password');
    await expect(page.getByPlaceholder(/이메일 주소|email/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /발송|send/i })).toBeVisible();
  });

  test('/auth/reset-password bounces unauthenticated users to /login', async ({ page }) => {
    // Without a recovery session (set by /auth/callback), the reset form
    // can't be submitted, so it should redirect back to /login.
    await page.goto('/auth/reset-password');
    // useEffect-based redirect; give the client a moment to evaluate
    // getUser() and call router.replace.
    await page.waitForURL(/\/login\?.*error=session-missing/, { timeout: 10_000 });
    expect(page.url()).toContain('error=session-missing');
  });

  test('/auth/callback with no code redirects home (no error spam)', async ({ page }) => {
    await page.goto('/auth/callback');
    // The callback handler redirects to `/` when there's no code AND no
    // error param. Final URL should be the language-prefixed root.
    await page.waitForURL(/\/(kr|en)\/?$/, { timeout: 10_000 });
  });
});
