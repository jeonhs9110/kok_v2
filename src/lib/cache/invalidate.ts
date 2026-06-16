'use server';

import { updateTag } from 'next/cache';
import { clearHeaderMemo } from './header';

// Tags must match the unstable_cache definitions in src/lib/cache/homepage.ts.
// updateTag is a Server-Action-only API in Next.js 16 that guarantees
// read-your-own-writes semantics — after this resolves, the calling admin's
// next request sees the fresh data without waiting on the 60s ISR TTL.
export type HomepageTag =
  | 'products'
  | 'carousel'
  | 'reviews'
  | 'promo_banners'
  | 'sub_hero'
  | 'instagram'
  | 'shorts'
  | 'top_stripe'
  | 'homepage_banners';

export async function revalidateHomepageData(tag: HomepageTag): Promise<void> {
  updateTag(tag);
  updateTag('homepage');
}

// Called by admin pages that edit nav menus, categories, or the logo —
// evicts the process-local memo in lib/cache/header.ts so the next page
// render sees the change without waiting on the 60s TTL. Only affects
// the current EC2 instance; other instances behind the ALB still see
// stale data until their own memo expires (acceptable for low-RPS
// admin-edited content).
export async function revalidateHeaderData(): Promise<void> {
  clearHeaderMemo();
}
