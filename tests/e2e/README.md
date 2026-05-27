# E2E tests (Playwright)

Critical-path browser tests that catch regressions in the flows that
matter most: homepage rendering, admin auth gate, and the
forgot-password loop. Run them before deploying anything that touches
auth, routing, or the storefront layout.

## Run locally

```bash
# Auto-starts `npm run dev` and points the tests at localhost:3000
npx playwright test

# Watch mode with the UI inspector
npx playwright test --ui

# Single file, headed (visible browser)
npx playwright test tests/e2e/smoke.spec.ts --headed
```

## Run against a deployed URL

```bash
BASE_URL=https://www.kokkokgarden.com npx playwright test
```

The `webServer` block in `playwright.config.ts` is skipped automatically
when `BASE_URL` is set, so this doesn't try to start a local dev server.

## Test-only Supabase account (for auth-touching tests)

Tests that need an authenticated user use a dedicated read-only
account so the suite never writes to production. Put the credentials
in `.env.test.local` (gitignored):

```env
E2E_USER_EMAIL=test-reader@kokkok.com
E2E_USER_PASSWORD=<the password>
```

The account should have `users.role = 'user'` (not admin) and exist
in `auth.users`. To create it:

1. Supabase dashboard → Authentication → Users → Add user → email +
   password.
2. The `handle_new_auth_user` trigger creates the matching
   `public.users` row with role='user' automatically.

## Conventions

- Tests must be **read-only**. No `insert`, `update`, `delete` against
  the live DB. If you need write coverage, use mocked fetch or a
  dedicated local Postgres via `supabase start`.
- Each `.spec.ts` should be runnable independently — no shared
  fixtures that assume order.
- Selectors prefer `getByRole` / `getByText` over CSS — they survive
  Tailwind class churn.

## What's covered today

| File                 | What it checks                                         |
|----------------------|--------------------------------------------------------|
| smoke.spec.ts        | Home renders, hero carousel present, footer phone visible |
| auth.spec.ts         | `/admin` redirects to `/login?next=...`, spoofed cookie still blocked, forgot-password page reachable |
| admin-products.spec.ts | (skipped by default — needs admin credentials) admin can navigate to products page |

## What's NOT covered (yet)

- Cart → checkout (no test payment flow)
- Product detail → purchase button states
- Admin save mutations (would write to prod)

These need either a staging Supabase or a checkout sandbox. Add in a
follow-up phase once we have either.
