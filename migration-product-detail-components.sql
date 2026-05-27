-- Adds a structured component list for the product detail body. Replaces
-- (with fallback) the existing free-form `detail_body` HTML field so the
-- designer can compose the page as ordered image / mp4 / YouTube blocks
-- that stack with zero margin between them.
--
-- Each element shape:
--   { "id": "uuid", "type": "image" | "video" | "youtube",
--     "url": "...", "sort_order": 0 }
--
-- `detail_body` is kept so existing products keep rendering until the
-- admin re-saves them with the new component list.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS detail_components jsonb DEFAULT '[]'::jsonb;
