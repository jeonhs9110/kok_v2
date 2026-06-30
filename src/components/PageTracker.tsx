'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Fires a single /api/track POST per route change with the path,
 * referrer, and window.location.search. The search string carries
 * any utm_source / utm_medium / utm_campaign that a campaign tagged
 * onto the landing URL — /api/track parses them into separate
 * columns at write time so the dashboard doesn't have to re-extract.
 *
 * Cookie-consent gate (2026-06-30 legal review):
 *   Before consent is given, this component must not POST anything —
 *   the request includes an ip_hash and device fingerprint that PIPA
 *   Article 22 + 정보통신망법 Article 23 treat as personal data, and
 *   sending it without an explicit Accept is a pre-consent collection
 *   violation. The CookieConsent banner writes
 *     kokkok_cookie_consent=accepted   (opt-in)
 *     kokkok_cookie_consent=declined   (opt-out)
 *   No cookie at all = banner hasn't been answered yet → DO NOT track.
 *
 * The pathname effect re-checks consent on every route change, so as
 * soon as the visitor clicks Accept the very next navigation starts
 * being recorded — no full reload required.
 */

const CONSENT_COOKIE = 'kokkok_cookie_consent';

function hasAcceptedAnalytics(): boolean {
  if (typeof document === 'undefined') return false;
  // Match `kokkok_cookie_consent=accepted` anywhere in the cookie jar.
  // The decline value writes the cookie too, so the absence-of-the-
  // cookie path (banner not yet answered) is also gated out.
  return new RegExp(`(?:^|;\\s*)${CONSENT_COOKIE}=accepted\\b`).test(document.cookie);
}

export default function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!hasAcceptedAnalytics()) return;
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        search: window.location.search || null,
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
