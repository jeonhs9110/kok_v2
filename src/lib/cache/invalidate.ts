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
  | 'homepage_banners'
  | 'homepage_section_order'
  | 'best_seller_display'
  // Added 2026-06-21 (final audit). getThemeTokens.ts:38 tags its
  // unstable_cache with 'theme_tokens', but the admin theme save was
  // only clearing the in-process header memo via revalidateHeaderData,
  // leaving the global ISR cache live for up to 60s. Storefront
  // customers saw the old palette for nearly a minute after an
  // operator-driven theme change. Now part of the tag union so save
  // handlers can evict properly.
  | 'theme_tokens'
  // Added 2026-06-29 (homepage builder audit). /admin/top-viewed save
  // tags the top_viewed config + the analytics-driven product list
  // cache so the operator's new window/count takes effect immediately
  // instead of waiting on the 5-minute analytics revalidate.
  | 'top_viewed_config'
  | 'analytics';

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
