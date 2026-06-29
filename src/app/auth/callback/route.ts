import { NextResponse, type NextRequest } from 'next/server';
import { getSupabaseServer } from '@/lib/supabase/server';

/**
 * OAuth / PKCE callback handler for Supabase Auth email flows.
 *
 * Reached when the user clicks a link in:
 *   - Password recovery email   → `/auth/callback?code=...&next=/auth/reset-password`
 *   - Magic link sign-in        → `/auth/callback?code=...&next=/`
 *   - Email confirmation        → `/auth/callback?code=...&next=/`
 *
 * The route exchanges the short-lived `code` for a real session using the
 * PKCE verifier stored in the visitor's browser cookie. This is the key
 * defense against Gmail / Outlook link prefetchers: the prefetcher hits
 * the URL without the verifier cookie and the exchange fails harmlessly,
 * leaving the human's click intact. Without PKCE (implicit/OTP flow),
 * the prefetcher consumes the one-shot token and the user sees
 * "Email link is invalid or has expired" on their first real click.
 *
 * Safe-list for `next`: only same-origin absolute paths. Any other shape
 * (offsite URL, protocol-relative, missing) falls back to `/`.
 */

function safeNext(raw: string | null): string {
  if (!raw) return '/';
  if (!raw.startsWith('/')) return '/';
  if (raw.startsWith('//')) return '/'; // protocol-relative; potential off-site
  return raw;
}

/**
 * Build the public-facing origin from the inbound request. We can't trust
 * `request.url` here because Next.js's standalone build constructs it from
 * the server's HOSTNAME env var, which our EC2 user-data sets to "0.0.0.0"
 * so Next can bind to all interfaces. A naive `new URL('/', request.url)`
 * therefore redirects the user's browser to `https://0.0.0.0:3000/` —
 * unreachable, and exactly the bug that broke the password-reset flow
 * on the first Phase 1.5 deploy.
 *
 * ALB forwards the real host as `x-forwarded-host` and the real scheme as
 * `x-forwarded-proto`. Echo those back so the Location header points at
 * what the visitor actually typed in the address bar.
 */
function getRequestOrigin(request: NextRequest): string {
  const host =
    request.headers.get('x-forwarded-host') ||
    request.headers.get('host') ||
    'www.kokkokgarden.com';
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  return `${proto}://${host}`;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const reqUrl = new URL(request.url);
  const next = safeNext(reqUrl.searchParams.get('next'));
  const origin = getRequestOrigin(request);

  // Supabase Auth may return an error in the query string when the verify
  // step itself fails (expired token, malformed link). Surface it to /login.
  const upstreamError = reqUrl.searchParams.get('error');
  const upstreamDesc = reqUrl.searchParams.get('error_description');
  if (upstreamError) {
    console.error('[auth/callback] Supabase returned upstream error:', upstreamError, upstreamDesc);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', upstreamDesc || upstreamError);
    return NextResponse.redirect(loginUrl);
  }

  const code = reqUrl.searchParams.get('code');
  if (!code) {
    // No code, no error — treat as a benign direct visit; just redirect to next.
    return NextResponse.redirect(new URL(next, origin));
  }

  const supabase = await getSupabaseServer();
  if (!supabase) {
    // 2026-06-29 — Supabase cutoff. /auth/callback only fires when a
    // visitor clicks a stale Supabase password-reset email link AFTER
    // the cutover. The Cognito flow uses /api/auth/cognito/reset-password
    // (code-based, no link), so nothing legitimate reaches this branch
    // anymore. Treat as link-expired and bounce to /login.
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'link-expired');
    return NextResponse.redirect(loginUrl);
  }
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[auth/callback] exchangeCodeForSession failed:', exchangeError);
    const loginUrl = new URL('/login', origin);
    loginUrl.searchParams.set('error', 'link-expired');
    return NextResponse.redirect(loginUrl);
  }

  // Session cookies were written by getSupabaseServer's cookie setter during
  // the exchange. The user is now signed in for the duration of the JWT.
  return NextResponse.redirect(new URL(next, origin));
}
