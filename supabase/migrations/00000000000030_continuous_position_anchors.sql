-- Continuous position anchors for carousel_slides + sub_hero_banners.
--
-- The 9-cell picker (tl/tc/tr/ml/mc/mr/bl/bc/br) only gave the admin
-- 9 discrete buckets for text + image placement. 송이 wanted pixel
-- freedom — click anywhere in a live preview and the text / image
-- pivot lands there. This migration adds the JSONB anchor columns,
-- backfills them from the existing 9-cell keys (so every saved slide
-- keeps its current visual placement), and leaves the old key columns
-- in place so a rollback is one-line if anything breaks live.
--
-- Each anchor is shaped as: { "x": 0..100, "y": 0..100 } (percentages).
-- Origin is the top-left corner of the slide. The render path centers
-- the text block / object-position around the anchor with edge-aware
-- offsets to keep content readable when the admin clicks near a wall.

-- ── carousel_slides ───────────────────────────────────────────────
ALTER TABLE public.carousel_slides
  ADD COLUMN IF NOT EXISTS text_anchor jsonb,
  ADD COLUMN IF NOT EXISTS text_anchor_mobile jsonb,
  ADD COLUMN IF NOT EXISTS image_anchor jsonb,
  ADD COLUMN IF NOT EXISTS image_anchor_mobile jsonb;

-- ── sub_hero_banners ──────────────────────────────────────────────
-- Sub-hero only has text positioning; the image is anchored inside its
-- own column so it doesn't need an image_anchor pair.
ALTER TABLE public.sub_hero_banners
  ADD COLUMN IF NOT EXISTS text_anchor jsonb,
  ADD COLUMN IF NOT EXISTS text_anchor_mobile jsonb;

-- Backfill — map every 9-cell key to its (x, y) percentage.
-- The mapping below matches POSITION_OPTIONS in src/lib/typography/options.ts
-- AFTER the 2026-06-09 flex-col axis fix (so any slide saved as 'bc'
-- which actually rendered at bottom-center post-fix continues to render
-- at bottom-center via {x:50, y:100}).
DO $$
DECLARE
  key_map jsonb := jsonb_build_object(
    'tl', jsonb_build_object('x', 0,   'y', 0),
    'tc', jsonb_build_object('x', 50,  'y', 0),
    'tr', jsonb_build_object('x', 100, 'y', 0),
    'ml', jsonb_build_object('x', 0,   'y', 50),
    'mc', jsonb_build_object('x', 50,  'y', 50),
    'mr', jsonb_build_object('x', 100, 'y', 50),
    'bl', jsonb_build_object('x', 0,   'y', 100),
    'bc', jsonb_build_object('x', 50,  'y', 100),
    'br', jsonb_build_object('x', 100, 'y', 100)
  );
BEGIN
  UPDATE public.carousel_slides
     SET text_anchor = key_map -> text_position
   WHERE text_anchor IS NULL AND text_position IS NOT NULL;

  UPDATE public.carousel_slides
     SET text_anchor_mobile = key_map -> text_position_mobile
   WHERE text_anchor_mobile IS NULL AND text_position_mobile IS NOT NULL;

  UPDATE public.carousel_slides
     SET image_anchor = key_map -> image_position
   WHERE image_anchor IS NULL AND image_position IS NOT NULL;

  UPDATE public.carousel_slides
     SET image_anchor_mobile = key_map -> image_position_mobile
   WHERE image_anchor_mobile IS NULL AND image_position_mobile IS NOT NULL;

  UPDATE public.sub_hero_banners
     SET text_anchor = key_map -> text_position
   WHERE text_anchor IS NULL AND text_position IS NOT NULL;

  UPDATE public.sub_hero_banners
     SET text_anchor_mobile = key_map -> text_position_mobile
   WHERE text_anchor_mobile IS NULL AND text_position_mobile IS NOT NULL;
END $$;

-- Documentation comments so anyone reading pg_dump knows what these are.
COMMENT ON COLUMN public.carousel_slides.text_anchor IS
  '{ "x": 0-100, "y": 0-100 } percent anchor for the desktop text block. Backfilled from the 9-cell text_position key in migration 30 (2026-06-09).';
COMMENT ON COLUMN public.carousel_slides.text_anchor_mobile IS
  '{ "x": 0-100, "y": 0-100 } percent anchor for the mobile text block.';
COMMENT ON COLUMN public.carousel_slides.image_anchor IS
  '{ "x": 0-100, "y": 0-100 } percent for desktop object-position focal point.';
COMMENT ON COLUMN public.carousel_slides.image_anchor_mobile IS
  '{ "x": 0-100, "y": 0-100 } percent for mobile object-position focal point.';
COMMENT ON COLUMN public.sub_hero_banners.text_anchor IS
  '{ "x": 0-100, "y": 0-100 } percent anchor for the desktop text block.';
COMMENT ON COLUMN public.sub_hero_banners.text_anchor_mobile IS
  '{ "x": 0-100, "y": 0-100 } percent anchor for the mobile text block.';
