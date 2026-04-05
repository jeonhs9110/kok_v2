'use client';

import { useEffect } from 'react';

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

export function getRecentItems(): RecentItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveRecentItems(items: RecentItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

export function trackView(item: Omit<RecentItem, 'viewedAt'>) {
  const items = getRecentItems().filter(i => i.id !== item.id);
  items.unshift({ ...item, viewedAt: Date.now() });
  saveRecentItems(items.slice(0, MAX_ITEMS));
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
