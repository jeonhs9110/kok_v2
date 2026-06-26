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

async function fetchWishlist(): Promise<{ productIds: string[] } | null> {
  try {
    const res = await fetch('/api/customer/wishlist', { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as { productIds: string[] };
  } catch {
    return null;
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
      if (result) {
        setSignedIn(true);
        setWishlist(new Set(result.productIds));
      }
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
      console.error('위시리스트 토글 실패:', err);
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
