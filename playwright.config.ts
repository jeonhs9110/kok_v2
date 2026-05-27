import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright config for KOKKOK Garden critical-path E2E tests.
 *
 * Default target is the local Next.js dev server (auto-started by
 * `webServer`). To run against a different environment, set `BASE_URL`:
 *
 *   BASE_URL=https://www.kokkokgarden.com npx playwright test
 *
 * IMPORTANT: tests must remain READ-ONLY. There's no staging Supabase, so
 * the suite runs against the real production DB. Any write would dirty
 * the live store. Auth flows that need a user log in with a dedicated
 * read-only test account (see tests/e2e/README.md for credentials, kept
 * out of git in `.env.test.local`).
 */

const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const IS_CI = !!process.env.CI;

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  // Forbid `.only` in CI so an accidental commit doesn't silently shrink coverage.
  forbidOnly: IS_CI,
  retries: IS_CI ? 2 : 0,
  // One worker keeps us under Supabase free-tier rate limits when CI runs
  // against the production DB. Local dev can override with --workers=N.
  workers: IS_CI ? 1 : undefined,
  reporter: IS_CI ? [['github'], ['list']] : 'list',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  use: {
    baseURL: BASE_URL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: IS_CI ? 'retain-on-failure' : 'off',
    locale: 'ko-KR',
    timezoneId: 'Asia/Seoul',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Mobile coverage — most Korean K-beauty traffic is mobile, so smoke
    // tests run on a phone viewport too. iPhone 14 is the most common
    // device in the access logs.
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],

  webServer: process.env.BASE_URL
    ? undefined
    : {
        command: 'npm run dev',
        url: 'http://localhost:3000',
        timeout: 120_000,
        reuseExistingServer: !IS_CI,
        stdout: 'ignore',
        stderr: 'pipe',
      },
});
