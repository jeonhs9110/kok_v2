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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const url = new URL(request.url);
  const next = safeNext(url.searchParams.get('next'));

  // Supabase Auth may return an error in the query string when the verify
  // step itself fails (expired token, malformed link). Surface it to /login.
  const upstreamError = url.searchParams.get('error');
  const upstreamDesc = url.searchParams.get('error_description');
  if (upstreamError) {
    console.error('[auth/callback] Supabase returned upstream error:', upstreamError, upstreamDesc);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', upstreamDesc || upstreamError);
    return NextResponse.redirect(loginUrl);
  }

  const code = url.searchParams.get('code');
  if (!code) {
    // No code, no error — treat as a benign direct visit; just redirect to next.
    return NextResponse.redirect(new URL(next, request.url));
  }

  const supabase = await getSupabaseServer();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    console.error('[auth/callback] exchangeCodeForSession failed:', exchangeError);
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('error', 'link-expired');
    return NextResponse.redirect(loginUrl);
  }

  // Session cookies were written by getSupabaseServer's cookie setter during
  // the exchange. The user is now signed in for the duration of the JWT.
  return NextResponse.redirect(new URL(next, request.url));
}
