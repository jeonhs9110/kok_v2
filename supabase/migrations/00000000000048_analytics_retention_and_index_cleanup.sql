-- 2026-06-30 — analytics retention helper + drop legacy duplicate indexes
--
-- Two unrelated cleanups bundled because they're both data-safety only,
-- no schema change, no down-stream code reference:
--
-- 1. Retention helper for public.analytics. The table is currently at
--    ~4,000 rows (3 months of traffic at this scale) and growing
--    unbounded; at 10× traffic + 1 year it would be ~3.5M rows and the
--    dashboard's full-table scans would crawl. RDS doesn't ship with
--    pg_cron enabled by default on parameter group 16, so we expose a
--    plain SQL function the next team can wire to EventBridge or a
--    small worker process. Default 180 days = 6 months retention which
--    covers every dashboard preset (today/7d/30d/90d).
--
-- 2. Drop legacy duplicate indexes that migration 47 superseded. Each
--    pair below has the same column prefix; postgres can serve queries
--    from the longer composite index, so the single-column variants
--    are dead storage + write overhead.
--
-- All operations IF EXISTS / IF NOT EXISTS so the migration is
-- idempotent across replays.

-- ─── 1. Analytics retention helper ──────────────────────────────────

CREATE OR REPLACE FUNCTION public.prune_analytics_older_than_days(retention_days integer DEFAULT 180)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  deleted_count bigint;
BEGIN
  IF retention_days IS NULL OR retention_days < 30 THEN
    RAISE EXCEPTION 'retention_days must be >= 30 (got %)', retention_days;
  END IF;

  DELETE FROM public.analytics
   WHERE created_at < NOW() - (retention_days || ' days')::interval;

  GET DIAGNOSTICS deleted_count = ROW_COUNT;
  RETURN deleted_count;
END;
$$;

COMMENT ON FUNCTION public.prune_analytics_older_than_days(integer) IS
  'Delete public.analytics rows older than the given retention window (default 180 days). Returns row count. Refuses windows < 30 days as a safety rail. Run manually via SELECT public.prune_analytics_older_than_days(); — wire to EventBridge / cron for production retention.';


-- ─── 2. Drop legacy duplicate indexes ───────────────────────────────
-- Each of these is covered by a composite index added in migration 47.

-- comments(post_id) → comments_post_created_idx(post_id, created_at)
DROP INDEX IF EXISTS public.idx_comments_post_id;

-- posts(menu_id) → posts_menu_published_created_idx(menu_id, is_admin_post DESC, created_at DESC) WHERE is_published
DROP INDEX IF EXISTS public.idx_posts_menu;

-- product_reviews(product_id) → product_reviews_product_created_idx(product_id, created_at DESC)
DROP INDEX IF EXISTS public.idx_product_reviews_product;

-- products(category_id) → products_category_idx(category_id) WHERE category_id IS NOT NULL
DROP INDEX IF EXISTS public.idx_products_category;

-- products(subcategory_id) → products_subcategory_idx(subcategory_id) WHERE subcategory_id IS NOT NULL
DROP INDEX IF EXISTS public.idx_products_subcategory;
