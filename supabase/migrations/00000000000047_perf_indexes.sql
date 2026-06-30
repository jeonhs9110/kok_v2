-- 2026-06-30 — Performance indexes for production scale prep
--
-- Hot queries that were full-scanning before this migration:
--   - getProductsFromPg(): ORDER BY created_at DESC over all products
--   - storefront-reads.getPostsByMenu: WHERE menu_id + is_published + sort
--   - storefront-reads.getComments: WHERE post_id ORDER BY created_at
--   - admin user-detail: SELECT FROM wishlist WHERE user_id
--   - admin/dashboard: aggregation over analytics
--
-- Single-column boolean indexes (e.g., idx_posts_published) are dropped
-- in favor of composite + partial indexes because postgres won't use a
-- low-selectivity boolean index by itself.
--
-- All CREATE INDEX use IF NOT EXISTS so the migration is idempotent.
-- In production we apply this with CREATE INDEX CONCURRENTLY via psql
-- separately (the supabase CLI doesn't support CONCURRENTLY in a tx).

CREATE INDEX IF NOT EXISTS products_active_created_idx
  ON public.products(is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS products_best_seller_idx
  ON public.products(is_best_seller)
  WHERE is_best_seller = true;

CREATE INDEX IF NOT EXISTS products_category_idx
  ON public.products(category_id)
  WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS products_subcategory_idx
  ON public.products(subcategory_id)
  WHERE subcategory_id IS NOT NULL;

-- Board listing under a menu — replaces idx_posts_published which was
-- a single-column boolean (unused by planner).
CREATE INDEX IF NOT EXISTS posts_menu_published_created_idx
  ON public.posts(menu_id, is_admin_post DESC, created_at DESC)
  WHERE is_published = true;

-- Comment listing on a post page — ASC because oldest-first is the
-- read order.
CREATE INDEX IF NOT EXISTS comments_post_created_idx
  ON public.comments(post_id, created_at);

CREATE INDEX IF NOT EXISTS wishlist_user_created_idx
  ON public.wishlist(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS wishlist_product_idx
  ON public.wishlist(product_id);

CREATE INDEX IF NOT EXISTS cart_items_user_idx
  ON public.cart_items(user_id);

-- public.analytics is the anonymous event log (id, country, path,
-- referrer, ip_hash, created_at, traffic_source, search_keyword,
-- device_type, utm_*). There is NO user_id column — sessions are
-- correlated via salted ip_hash. The original migration line indexed
-- (user_id) WHERE user_id IS NOT NULL, which failed at apply time
-- with "column user_id does not exist". The dashboard's real hot path
-- is country + time aggregation, so index that instead.
CREATE INDEX IF NOT EXISTS analytics_country_created_idx
  ON public.analytics(country, created_at DESC)
  WHERE country IS NOT NULL AND country <> 'UNKNOWN';

CREATE INDEX IF NOT EXISTS product_reviews_product_created_idx
  ON public.product_reviews(product_id, created_at DESC);

-- Customer profile country lookup — used by /api/admin/users CSV export
-- and the (planned) marketing-segment filter.
CREATE INDEX IF NOT EXISTS customer_profiles_country_idx
  ON public.customer_profiles(country)
  WHERE country IS NOT NULL;
