'use client';

import { useEffect } from 'react';

/**
 * Listens for the `kokkok-session-expired` window event emitted by
 * `authedFetch` when a silent refresh fails (refresh token expired,
 * revoked, or Cognito rejected it). Bounces the customer to /login
 * with a `next=<pathname>` query so they can pick up where they left
 * off after re-authenticating.
 *
 * Prior to this listener, an authed customer whose 30-day refresh
 * cookie elapsed saw silent 401s on every mutation with no signal
 * about what to do — Round 20 flagged the gap and Round 22 wired
 * the auto-refresh path; this component is the last-resort UI
 * fallback when refresh itself fails.
 */
export default function SessionExpiredListener() {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let redirected = false;
    const onExpired = () => {
      if (redirected) return;
      redirected = true;
      // Preserve the current path so /login can bounce back. Use
      // location.pathname + search — router.push would need context
      // this listener doesn't have.
      const next = window.location.pathname + window.location.search;
      const url = `/login?next=${encodeURIComponent(next)}&reason=session_expired`;
      // Round 28: replace() instead of assign(). KakaoTalk in-app iOS
      // mishandles history-stack entries pushed by a POST-response-
      // triggered handler and can hang the WebView on a white-screen
      // spinner. replace() avoids the extra history entry and
      // consistently unwinds the JS context in the in-app WebView.
      window.location.replace(url);
    };
    window.addEventListener('kokkok-session-expired', onExpired);
    return () => window.removeEventListener('kokkok-session-expired', onExpired);
  }, []);
  return null;
}
