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
  | 'analytics'
  // Added 2026-06-29 (storefront sweep). Footer's getCachedBusinessInfo
  // and BusinessInfoDisclosure both tag with 'business_info'; without
  // this entry, admin saves of business_info via /admin/legal would
  // stay stale on the footer + the privacy/terms compliance block for
  // up to 5 minutes (Footer's unstable_cache revalidate window) AFTER
  // the operator clicks save. revalidateHeaderData() only clears the
  // in-process header memo; the unstable_cache layer needs its own
  // tag eviction.
  | 'business_info'
  // Added 2026-06-29 (admin sweep r7). getActiveSiteBackground tags
  // with 'site_background', but the /admin/logo background management
  // hook (useBackgroundManagement) never called revalidateHomepageData
  // at all — so after operator activated/deactivated/deleted a
  // background row, the storefront kept rendering the previously-active
  // background for up to 60s (the unstable_cache TTL). Particularly
  // jarring for video backgrounds where the operator hits ▶️ Activate
  // and expects the live storefront preview to follow.
  | 'site_background'
  // Added 2026-07-01 (Round 19 cache sweep). The sitemap's
  // unstable_cache is tagged with 'menus' / 'posts' / 'pages' /
  // 'reviews', but the HomepageTag union didn't include the first
  // three — meaning no admin save handler could evict them at the
  // type level. New menu / post / page publishes were invisible to
  // Google / Naver / Bing for up to 1 hour (the sitemap TTL). Adding
  // them here lets useMenus, useMenus/[menuId]/posts, and usePages
  // fire revalidateHomepageData('menus'|'posts'|'pages') alongside
  // their existing header-memo evictions so sitemap.xml reflects the
  // change within one revalidate cycle.
  | 'menus'
  | 'posts'
  | 'pages';

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
