'use server';

import { updateTag } from 'next/cache';

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
  | 'shorts';

export async function revalidateHomepageData(tag: HomepageTag): Promise<void> {
  updateTag(tag);
  updateTag('homepage');
}
