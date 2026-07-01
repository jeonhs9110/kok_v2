'use client';

import { createContext, useContext, useCallback, useSyncExternalStore, type ReactNode } from 'react';

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  quantity: number;
}

interface CartContextValue {
  items: CartItem[];
  addItem: (item: Omit<CartItem, 'quantity'>, quantity?: number) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  removeItem: (productId: string) => void;
  clearCart: () => void;
  totalCount: number;
  totalPrice: number;
}

const STORAGE_KEY = 'kokkok_cart';

/**
 * Per-item quantity ceiling. 99 is generous for real customer intent —
 * a customer legitimately buying 100+ of one SKU is the operator-side
 * B2B path, not the storefront cart. Without a cap, a double-tap on
 * mobile 3G / an autorepeated `+` key on a stuck keyboard / a scripted
 * click could push quantity into overflow territory, breaking the
 * price-total display (Number.toLocaleString of Number.MAX_SAFE_INTEGER
 * spills out of the line-total column and pushes cart layout off-screen).
 */
const MAX_QTY_PER_ITEM = 99;

function isValidCartItem(x: unknown): x is CartItem {
  if (!x || typeof x !== 'object') return false;
  const o = x as Record<string, unknown>;
  return typeof o.productId === 'string'
    && typeof o.name === 'string'
    && typeof o.price === 'number' && Number.isFinite(o.price)
    && typeof o.originalPrice === 'number' && Number.isFinite(o.originalPrice)
    && typeof o.imageUrl === 'string'
    && typeof o.quantity === 'number' && Number.isFinite(o.quantity) && o.quantity > 0;
}

/**
 * Module-level cart store backed by localStorage.
 *
 * Why this shape (vs the old useState + useEffect pattern):
 *
 *   1. Eliminates the "hydrate localStorage on mount" setState-in-effect
 *      pattern that React 19's `react-hooks/set-state-in-effect` rule
 *      flags as cascading.
 *   2. Cross-tab sync — the `storage` event subscription means a checkout
 *      in tab A immediately empties the cart badge in tab B. Old code
 *      had no listener so the two tabs diverged silently.
 *   3. No more debounced rAF write — every mutation now writes
 *      synchronously through `save()`. Cart writes are tiny and
 *      infrequent; we don't need to batch them.
 *
 * `getServerSnapshot` returns a frozen empty array so SSR + first client
 * render see identical content. The second client render reads the real
 * localStorage value via `getClientSnapshot`.
 */

let cachedItems: CartItem[] | null = null;
const listeners = new Set<() => void>();

function loadFromStorage(): CartItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(isValidCartItem);
    if (valid.length !== parsed.length) {
      console.warn(`[cart] dropped ${parsed.length - valid.length} malformed item(s) from localStorage`);
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(valid)); } catch {}
    }
    return valid;
  } catch (err) {
    console.error('[cart] localStorage parse failed:', err);
    return [];
  }
}

// Once per process — Safari private mode has 0 quota, and a suddenly-
// full localStorage silently makes every cart write disappear on next
// reload. Log ONCE so CloudWatch surfaces the class without one bad
// tab spamming ingest, and structure it so a handoff engineer can key
// on event=cart.storage.failed.
let storageFailureLogged = false;
function saveToStorage(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (err) {
    if (!storageFailureLogged) {
      storageFailureLogged = true;
      try {
        console.warn(JSON.stringify({
          event: 'cart.storage.failed',
          reason: err && typeof err === 'object' && 'name' in err
            ? String((err as { name: unknown }).name)
            : 'unknown',
        }));
      } catch { /* never let logging break the cart */ }
    }
  }
}

function getClientItems(): CartItem[] {
  if (cachedItems === null) cachedItems = loadFromStorage();
  return cachedItems;
}

function mutate(updater: (prev: CartItem[]) => CartItem[]) {
  const next = updater(getClientItems());
  cachedItems = next;
  saveToStorage(next);
  listeners.forEach(l => l());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  // Cross-tab sync — `storage` fires in other tabs (not the one that wrote).
  // The writing tab already updated via `mutate()`, so the listener only
  // matters when another tab changed localStorage.
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cachedItems = loadFromStorage();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

const EMPTY: readonly CartItem[] = Object.freeze([]);
function getServerSnapshot(): readonly CartItem[] {
  return EMPTY;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(
    subscribe,
    getClientItems,
    getServerSnapshot,
  ) as CartItem[];

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    // Clamp any single add to the ceiling, and clamp the accumulated
    // running total when a card is re-tapped for an already-carted
    // product. Without the outer clamp, N re-taps produced a
    // quantity of N; with the clamp, it stops at MAX_QTY_PER_ITEM.
    const add = Math.max(1, Math.min(quantity, MAX_QTY_PER_ITEM));
    mutate(prev => {
      const existing = prev.find(i => i.productId === item.productId);
      if (existing) {
        return prev.map(i =>
          i.productId === item.productId
            ? { ...i, quantity: Math.min(i.quantity + add, MAX_QTY_PER_ITEM) }
            : i,
        );
      }
      return [...prev, { ...item, quantity: add }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    // Treat 0 (or negative) as "remove" — matches customer intent for
    // any future editable-qty input (typing 0 to delete the line).
    // Prior code silently no-op'd, leaving the item at its stale
    // quantity — a classic silent-failure trap.
    if (quantity < 1) {
      mutate(prev => prev.filter(i => i.productId !== productId));
      return;
    }
    const clamped = Math.min(quantity, MAX_QTY_PER_ITEM);
    mutate(prev => prev.map(i => i.productId === productId ? { ...i, quantity: clamped } : i));
  }, []);

  const removeItem = useCallback((productId: string) => {
    mutate(prev => prev.filter(i => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => {
    mutate(() => []);
  }, []);

  const totalCount = items.reduce((sum, i) => sum + i.quantity, 0);
  const totalPrice = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, updateQuantity, removeItem, clearCart, totalCount, totalPrice }}>
      {children}
    </CartContext.Provider>
  );
}

const fallback: CartContextValue = {
  items: [],
  addItem: () => {},
  updateQuantity: () => {},
  removeItem: () => {},
  clearCart: () => {},
  totalCount: 0,
  totalPrice: 0,
};

export function useCart() {
  const ctx = useContext(CartContext);
  return ctx ?? fallback;
}
