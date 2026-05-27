'use client';

import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';

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

const CartContext = createContext<CartContextValue | null>(null);

const STORAGE_KEY = 'kokkok_cart';

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

function loadCart(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Drop entries that don't match the current shape — guards against an
    // older cart schema, dev console tampering, or extension corruption
    // (any of which would otherwise make totalPrice/totalCount NaN).
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

function saveCart(items: CartItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setMounted(true);
  }, []);

  // Debounce localStorage writes via rAF — multiple addItem calls in the
  // same tick collapse into one synchronous write at the next paint
  // instead of N writes on the main thread.
  useEffect(() => {
    if (!mounted) return;
    const id = requestAnimationFrame(() => saveCart(items));
    return () => cancelAnimationFrame(id);
  }, [items, mounted]);

  const addItem = useCallback((item: Omit<CartItem, 'quantity'>, quantity = 1) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === item.productId);
      if (existing) {
        return prev.map(i =>
          i.productId === item.productId
            ? { ...i, quantity: i.quantity + quantity }
            : i
        );
      }
      return [...prev, { ...item, quantity }];
    });
  }, []);

  const updateQuantity = useCallback((productId: string, quantity: number) => {
    if (quantity < 1) return;
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity } : i));
  }, []);

  const removeItem = useCallback((productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

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
