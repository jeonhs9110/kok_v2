'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface WishlistContextValue {
  /** Set of product IDs the current user has wishlisted. Empty when guest or still loading. */
  wishlist: Set<string>;
  isWishlisted: (productId: string) => boolean;
  /** Toggles wishlist for the given product. Returns the new state, or null when the user must sign in first. */
  toggle: (productId: string) => Promise<boolean | null>;
  /** True until the initial auth + wishlist fetch settles. */
  loading: boolean;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ children }: { children: ReactNode }) {
  const [wishlist, setWishlist] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!supabase) { setLoading(false); return; }
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (cancelled) return;
        if (!user) { setLoading(false); return; }
        setUserId(user.id);
        const { data, error } = await supabase
          .from('wishlist')
          .select('product_id')
          .eq('user_id', user.id);
        if (cancelled) return;
        if (error) {
          console.error('위시리스트 로드 실패:', error);
        } else if (data) {
          setWishlist(new Set(data.map(d => d.product_id)));
        }
      } catch (err) {
        console.error('위시리스트 초기화 실패:', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const isWishlisted = useCallback((productId: string) => wishlist.has(productId), [wishlist]);

  const toggle = useCallback(async (productId: string): Promise<boolean | null> => {
    if (!supabase) return null;
    if (!userId) return null;

    const currentlyWishlisted = wishlist.has(productId);
    const next = new Set(wishlist);
    if (currentlyWishlisted) next.delete(productId); else next.add(productId);
    setWishlist(next);

    try {
      if (currentlyWishlisted) {
        await supabase.from('wishlist').delete().eq('user_id', userId).eq('product_id', productId);
      } else {
        await supabase.from('wishlist').insert([{ user_id: userId, product_id: productId }]);
      }
      return !currentlyWishlisted;
    } catch (err) {
      console.error('위시리스트 토글 실패:', err);
      setWishlist(wishlist);
      return currentlyWishlisted;
    }
  }, [userId, wishlist]);

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

/** True when the wishlist context isn't mounted (e.g. on /admin pages outside the storefront layout). */
export function useOptionalWishlist(): WishlistContextValue | null {
  return useContext(WishlistContext);
}
