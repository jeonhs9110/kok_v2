'use client';

/**
 * Wrapper around window.fetch that transparently refreshes the
 * customer's Cognito session on a 401 and retries the original
 * request ONCE. Falls back to a bounce to /login when the refresh
 * itself fails.
 *
 * Why this exists: the ID token cookie expires after 1h (Cognito
 * default), and prior to this helper every authed customer POST
 * (wishlist toggle, profile save, comment write) silently 401'd
 * mid-session with no auto-recovery. Round 20 flagged the gap;
 * Round 22 design settled on per-caller refresh (this helper)
 * rather than middleware because Next.js 16 middleware can't
 * cleanly rewrite request cookies for downstream handlers.
 *
 * Usage:
 *
 *   const res = await authedFetch('/api/customer/wishlist', {
 *     method: 'POST',
 *     body: JSON.stringify({ productId }),
 *   });
 *
 * The response shape is identical to fetch's, so drop-in swap.
 *
 * Concurrency: multiple concurrent 401s in the same tab coalesce
 * into a single /api/auth/cognito/refresh call via a module-level
 * Promise singleton. Without coalescing, three tabs opening at
 * the same time would each hit refresh independently and — once
 * Cognito refresh-token rotation lands via Terraform — the last
 * two would fail because the first invalidated the shared token.
 */

let inFlightRefresh: Promise<boolean> | null = null;

async function refreshOnce(): Promise<boolean> {
  if (inFlightRefresh) return inFlightRefresh;
  inFlightRefresh = (async () => {
    try {
      const res = await fetch('/api/auth/cognito/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
      });
      return res.ok;
    } catch {
      return false;
    } finally {
      // Reset the singleton so the NEXT session-expiry can trigger
      // its own refresh, but not until after a small delay to
      // absorb any burst of 401s from concurrent requests started
      // just before the refresh completed.
      setTimeout(() => { inFlightRefresh = null; }, 250);
    }
  })();
  return inFlightRefresh;
}

/**
 * Notify the app that the session has definitively expired and
 * the customer needs to re-authenticate. Consumers can listen for
 * the `kokkok-session-expired` window event to show a toast +
 * router.push('/login?next=...').
 */
function dispatchSessionExpired(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent('kokkok-session-expired'));
  } catch { /* older browsers — noop */ }
}

export async function authedFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const first = await fetch(input, init);
  if (first.status !== 401) return first;

  // Try to refresh silently. On success, retry the original once.
  const refreshed = await refreshOnce();
  if (!refreshed) {
    dispatchSessionExpired();
    return first;
  }
  return await fetch(input, init);
}
