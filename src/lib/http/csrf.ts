import { NextResponse } from 'next/server';

/**
 * SameSite=Lax cookies survive top-level form-submit navigations —
 * meaning a phishing page can force a state-changing POST against
 * this site with the victim's cookies riding along. `assertSameOrigin`
 * closes that door by requiring every mutating handler's request to
 * carry an `Origin` (or fallback `Referer`) header matching this
 * site's own origin.
 *
 * Belt-and-suspenders on top of the existing sameSite protection:
 * modern browsers set Origin on POSTs, and the check is essentially
 * free (one header read + one string compare per request). Prior
 * mutating routes had NO Origin/Referer check at all — audited in
 * Round 20 and 22 — so a top-level `<form method="POST">` from
 * attacker.com could sign a customer out mid-checkout, publish a
 * fake comment as them, or (worst case) delete their profile via
 * a POST-shaped route.
 */

// kokkokgarden.com and its www subdomain are the only public storefront
// origins. Localhost is allowed in dev; env-var-driven so a preview
// deploy on a temporary host can add its own without a code change.
const ALLOWED_ORIGINS: string[] = [
  'https://www.kokkokgarden.com',
  'https://kokkokgarden.com',
  ...(process.env.NODE_ENV !== 'production'
    ? ['http://localhost:3000', 'http://localhost:3001']
    : []),
  ...(process.env.CSRF_ALLOWED_ORIGIN
    ? [process.env.CSRF_ALLOWED_ORIGIN]
    : []),
];

/**
 * Returns null when the request's Origin (or fallback Referer)
 * matches the allow-list; returns a 403 NextResponse when it
 * doesn't. Use `if (denied) return denied;` at the top of every
 * mutating handler.
 *
 * Behaviour when both Origin AND Referer headers are absent:
 *   - Production: reject (a legitimate browser POST always sets
 *     Origin; the absence means the caller is probably curl-style
 *     tooling that bypasses the CSRF concern anyway, but the safer
 *     default is deny).
 *   - Dev: allow (curl / thunder client testing must work).
 */
export function assertSameOrigin(request: Request): NextResponse | null {
  const origin = request.headers.get('origin');
  const referer = request.headers.get('referer');

  if (origin) {
    if (ALLOWED_ORIGINS.includes(origin)) return null;
    logDenial('origin_mismatch', origin);
    return NextResponse.json({ error: 'csrf_forbidden' }, { status: 403 });
  }

  if (referer) {
    // Parse the origin off the Referer URL. If parse fails or the
    // origin doesn't match, deny.
    try {
      const refererOrigin = new URL(referer).origin;
      if (ALLOWED_ORIGINS.includes(refererOrigin)) return null;
      logDenial('referer_mismatch', refererOrigin);
      return NextResponse.json({ error: 'csrf_forbidden' }, { status: 403 });
    } catch {
      logDenial('referer_unparseable', referer.slice(0, 100));
      return NextResponse.json({ error: 'csrf_forbidden' }, { status: 403 });
    }
  }

  // No Origin, no Referer. Allow in dev; deny in prod.
  if (process.env.NODE_ENV !== 'production') return null;
  logDenial('no_origin_no_referer', null);
  return NextResponse.json({ error: 'csrf_forbidden' }, { status: 403 });
}

function logDenial(reason: string, value: string | null): void {
  try {
    console.warn(JSON.stringify({
      event: 'csrf.denied',
      reason,
      value: value ? value.slice(0, 200) : null,
    }));
  } catch { /* never let logging break auth */ }
}
