'use client';

import { useEffect, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'kokkok_recent';
const MAX_ITEMS = 20;

export interface RecentItem {
  id: string;
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
  viewedAt: number;
}

let cached: RecentItem[] | null = null;
const listeners = new Set<() => void>();

function loadFromStorage(): RecentItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as RecentItem[]) : [];
  } catch {
    return [];
  }
}

function saveToStorage(items: RecentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

function notify() {
  listeners.forEach(l => l());
}

// Exported for tracking views and for the recent-items list page. `trackView`
// writes through the cache so subscribers re-render immediately; the same
// `getRecentItems` shape is preserved for any callers that need a one-shot
// read (e.g. analytics).
export function getRecentItems(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  if (cached === null) cached = loadFromStorage();
  return cached;
}

export function trackView(item: Omit<RecentItem, 'viewedAt'>) {
  if (typeof window === 'undefined') return;
  const current = getRecentItems();
  const next = [{ ...item, viewedAt: Date.now() }, ...current.filter(i => i.id !== item.id)].slice(0, MAX_ITEMS);
  cached = next;
  saveToStorage(next);
  notify();
}

export function clearRecentItems() {
  if (typeof window === 'undefined') return;
  cached = [];
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
  notify();
}

export function removeRecentItem(id: string) {
  if (typeof window === 'undefined') return;
  const current = getRecentItems();
  const next = current.filter(i => i.id !== id);
  cached = next;
  saveToStorage(next);
  notify();
}

const EMPTY: readonly RecentItem[] = Object.freeze([]);

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return;
    cached = loadFromStorage();
    listener();
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Subscribe to the recently-viewed list. Returns the current snapshot and
 * re-renders the component on `trackView` / `clearRecentItems` /
 * `removeRecentItem` calls, plus any cross-tab `storage` events.
 */
export function useRecentItems(): readonly RecentItem[] {
  return useSyncExternalStore(
    subscribe,
    getRecentItems,
    () => EMPTY,
  );
}

interface Props {
  productId: string;
  name: string;
  price: number;
  originalPrice: number;
  imageUrl: string;
}

export default function RecentViewTracker({ productId, name, price, originalPrice, imageUrl }: Props) {
  useEffect(() => {
    trackView({ id: productId, name, price, originalPrice, imageUrl });
  }, [productId, name, price, originalPrice, imageUrl]);

  return null;
}
