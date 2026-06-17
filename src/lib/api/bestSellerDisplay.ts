import { cache } from 'react';
import { supabase } from '@/lib/api/products';

export interface BestSellerDisplay {
  card_scale: number;
  gap_x: number;
  gap_y: number;
}

export const DEFAULT_BEST_SELLER_DISPLAY: BestSellerDisplay = {
  card_scale: 1.0,
  gap_x: 16,
  gap_y: 48,
};

function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

function parse(raw: unknown): BestSellerDisplay {
  let obj: unknown = raw;
  if (typeof raw === 'string') {
    try { obj = JSON.parse(raw); } catch { return DEFAULT_BEST_SELLER_DISPLAY; }
  }
  if (!obj || typeof obj !== 'object') return DEFAULT_BEST_SELLER_DISPLAY;
  const o = obj as Record<string, unknown>;
  return {
    card_scale: clamp(typeof o.card_scale === 'number' ? o.card_scale : 1.0, 0.6, 2.5),
    gap_x: clamp(typeof o.gap_x === 'number' ? o.gap_x : 16, 0, 80),
    gap_y: clamp(typeof o.gap_y === 'number' ? o.gap_y : 48, 0, 160),
  };
}

export const getBestSellerDisplay = cache(async (): Promise<BestSellerDisplay> => {
  if (!supabase) return DEFAULT_BEST_SELLER_DISPLAY;
  try {
    const { data, error } = await supabase
      .from('site_settings')
      .select('value')
      .eq('key', 'best_seller_display')
      .maybeSingle();
    if (error || !data) return DEFAULT_BEST_SELLER_DISPLAY;
    return parse(data.value);
  } catch {
    return DEFAULT_BEST_SELLER_DISPLAY;
  }
});
