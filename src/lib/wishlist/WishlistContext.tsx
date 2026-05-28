'use client';

import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

// Session-aware client. Phase 4 RLS lockdown on `wishlist` is self-only
// (auth.uid() = user_id) — see migration 20. The bare anon client this
// used to use couldn't pass the auth.uid() check, so wishlist would have
// silently stopped working post-lockdown without this swap.
const supabase = getSupabaseBrowser();

interface WishlistContextValue {
  wishlist: Set<string>;
  isWishlisted: (productId: string) => boolean;
  /** Toggles wishlist for the given product. Returns the new state, or null when the user must sign in first or another toggle is already in flight for this product. */
  toggle: (productId: string) => Promise<boolean | null>;
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

async function fetchWishlist(userId: string): Promise<Set<string>> {
  if (!supabase) return new Set();
  const { data, error } = await supabase
    .from('wishlist')
    .select('product_id')
    .eq('user_id', userId);
  if (error) {
    console.error('위시리스트 로드 실패:', error);
    return new Set();
  }
  return new Set((data ?? []).map(d => d.product_id));
}

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  // Tracks product IDs with an in-flight toggle. Ignores re-clicks until the
  // first request resolves, so rapid double-clicks can't race two opposing
  // DB writes against each other.
  const inFlightRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    let cancelled = false;

    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) { setLoading(false); return; }
        setUserId(user.id);
        const ids = await fetchWishlist(user.id);
        if (!cancelled) setWishlist(ids);
      } catch (err) {
        console.error('위시리스트 초기화 실패:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    // Auth-state subscription — if the user signs in after mount (or signs
    // out), pick up the new wishlist instead of staying stuck on the
    // mount-time state. Without this, post-login clicks bounce to /login.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (cancelled) return;
      const next = session?.user?.id ?? null;
      setUserId(prev => {
        if (prev === next) return prev;
        if (next) {
          fetchWishlist(next).then(ids => { if (!cancelled) setWishlist(ids); });
        } else {
          setWishlist(new Set());
        }
        return next;
      });
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  const isWishlisted = useCallback((productId: string) => wishlist.has(productId), [wishlist]);

  // Functional setState everywhere — toggle no longer depends on the wishlist
  // value, so its identity is stable across renders. That means a stale
  // closure can't roll back to the wrong set, and React.memo on consumers
  // becomes viable later.
  const toggle = useCallback(async (productId: string): Promise<boolean | null> => {
    if (!supabase) return null;
    if (!userId) return null;
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
      if (optimisticNext) {
        const { error } = await supabase.from('wishlist').insert([{ user_id: userId, product_id: productId }]);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('wishlist').delete().eq('user_id', userId).eq('product_id', productId);
        if (error) throw error;
      }
      return optimisticNext;
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
  }, [userId]);

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
