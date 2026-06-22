/**
 * Phase D2 — flag the auth UI checks to decide whether to dispatch
 * sign-in/sign-up/recovery requests through `/api/auth/cognito/*` or
 * to keep using the legacy supabase.auth path.
 *
 * Server-side dispatchers (`proxy.ts`, `requireAdmin()`) read
 * `process.env.USE_COGNITO` directly. The browser-side dispatch
 * mirror has to be inlined at build time, so it has the
 * `NEXT_PUBLIC_` prefix.
 *
 * Both env vars MUST be flipped together at Phase F cutover.
 */
export const USE_COGNITO_FROM_BROWSER = process.env.NEXT_PUBLIC_USE_COGNITO === 'true';
