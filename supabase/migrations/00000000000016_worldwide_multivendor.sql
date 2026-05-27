-- ============================================================
-- KOKKOK GARDEN V2 — Worldwide multi-vendor support
-- Phase 2 (#3): allow multiple local vendors per country + images
-- Run in Supabase → SQL Editor
-- ============================================================

-- Per-vendor logo image (e.g. Taobao/Shopee logo)
ALTER TABLE public.worldwide_retailers
  ADD COLUMN IF NOT EXISTS store_logo_url text DEFAULT '';

-- Per-country visual image (shown on the country card).
-- Stored on every row for a country_code (admin UI keeps them in sync).
ALTER TABLE public.worldwide_retailers
  ADD COLUMN IF NOT EXISTS country_image_url text DEFAULT '';

COMMENT ON COLUMN public.worldwide_retailers.store_logo_url IS
  'Vendor logo shown on the vendor list (e.g. Taobao, Shopee). Optional — blank shows text only.';
COMMENT ON COLUMN public.worldwide_retailers.country_image_url IS
  'Country card image. Duplicated across all vendor rows sharing the same country_code; admin updates in bulk.';

-- Ensure the public bucket we already use for product images is usable
-- for worldwide assets too. product-images is already public per schema.sql.
-- No extra storage setup needed.
