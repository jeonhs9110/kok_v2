'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';

/**
 * Customer wishlist context. Reads + writes through /api/customer/wishlist,
 * which dispatches to RDS via the standard USE_RDS flag and uses
 * requireCustomer() (Cognito ID token cookie) for auth — no direct
 * Supabase access from the browser.
 */

interface WishlistContextValue {
  wishlist: Set<string>;
  isWishlisted: (productId: string) => boolean;
  /** Toggles wishlist for the given product. Returns the new state, or null when not signed in or already in flight. */
  toggle: (productId: string) => Promise<boolean | null>;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

type FetchResult =
  | { kind: 'ok'; productIds: string[] }
  | { kind: 'unauthenticated' }
  | { kind: 'error' };

/**
 * Distinguish "no session" (401) from a transient read failure (5xx /
 * network). Previously both fell into `null` and the provider treated
 * every failure as "signed out" — a transient GET failure then made
 * every subsequent toggle return `null`, which `ProductCard` reads as
 * "not signed in" and redirects the customer to /login. Confusing:
 * their session was fine; the read blipped.
 */
async function fetchWishlist(): Promise<FetchResult> {
  try {
    const res = await fetch('/api/customer/wishlist', { cache: 'no-store' });
    if (res.status === 401) return { kind: 'unauthenticated' };
    if (!res.ok) return { kind: 'error' };
    const json = (await res.json()) as { productIds: string[] };
    return { kind: 'ok', productIds: json.productIds };
  } catch {
    return { kind: 'error' };
  }
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [signedIn, setSignedIn] = useState(false);
  const [loading, setLoading] = useState(true);
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const result = await fetchWishlist();
      if (cancelled) return;
      if (result.kind === 'ok') {
        setSignedIn(true);
        setWishlist(new Set(result.productIds));
      } else if (result.kind === 'error') {
        // Assume the customer is signed in on a transient read failure
        // so `toggle` still runs its POST — which does its own auth
        // check server-side. The optimistic UI is empty (we couldn't
        // read the initial set) but a toggle click still works.
        setSignedIn(true);
      }
      // 'unauthenticated' → keep signedIn=false, which correctly gates
      // toggle() and lets ProductCard redirect to /login.
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const isWishlisted = useCallback((productId: string) => wishlist.has(productId), [wishlist]);

  const toggle = useCallback(async (productId: string): Promise<boolean | null> => {
    if (!signedIn) return null;
    if (inFlightRef.current.has(productId)) return null;
    inFlightRef.current.add(productId);

    let optimisticNext = false;
    setWishlist(prev => {
      optimisticNext = !prev.has(productId);
      const next = new Set(prev);
      if (optimisticNext) next.add(productId);
      else next.delete(productId);
      return next;
    });

    try {
      const res = await fetch('/api/customer/wishlist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });
      if (!res.ok) throw new Error('http_' + res.status);
      const json = (await res.json()) as { wishlisted: boolean };
      // Reconcile to server truth in case of races.
      setWishlist(prev => {
        const next = new Set(prev);
        if (json.wishlisted) next.add(productId);
        else next.delete(productId);
        return next;
      });
      return json.wishlisted;
    } catch (err) {
      // English + structured — Round 10 log-quality agent flagged the
      // previous Korean-only message as unusable for a non-Korean
      // operator triaging via CloudWatch Insights.
      console.error('[wishlist] toggle failed', {
        productId,
        error: err instanceof Error ? err.message : String(err),
      });
      setWishlist(prev => {
        const next = new Set(prev);
        if (optimisticNext) next.delete(productId);
        else next.add(productId);
        return next;
      });
      return !optimisticNext;
    } finally {
      inFlightRef.current.delete(productId);
    }
  }, [signedIn]);

  return (
    <WishlistContext.Provider value={{ wishlist, isWishlisted, toggle, loading }}>
      {children}
    </WishlistContext.Provider>
  );
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error('useWishlist must be used within WishlistProvider');
  return ctx;
}

export function useOptionalWishlist(): WishlistContextValue | null {
  return useContext(WishlistContext);
}
