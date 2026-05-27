-- ============================================================
-- KOKKOK GARDEN V2 — Consolidated migration for Phases 2, 3, 4, 5
-- Run this ENTIRE block in Supabase → SQL Editor. Safe to run multiple times.
-- ============================================================

-- ─────────────────────────────────────────────────────────
-- Phase 2 — Site settings table (logo, contact info, etc.)
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text DEFAULT '',
  updated_at timestamptz DEFAULT timezone('utc', now())
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public write site_settings" ON public.site_settings;
CREATE POLICY "Public read site_settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Public write site_settings" ON public.site_settings FOR ALL USING (true);

INSERT INTO public.site_settings (key, value) VALUES ('logo_url', '') ON CONFLICT (key) DO NOTHING;

-- Public storage bucket for site-level assets (logo etc.)
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "site-assets public read" ON storage.objects;
DROP POLICY IF EXISTS "site-assets public write" ON storage.objects;
CREATE POLICY "site-assets public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-assets');
CREATE POLICY "site-assets public write" ON storage.objects
  FOR ALL USING (bucket_id = 'site-assets');

-- ─────────────────────────────────────────────────────────
-- Phase 2 — Worldwide multi-vendor columns
-- ─────────────────────────────────────────────────────────
ALTER TABLE public.worldwide_retailers
  ADD COLUMN IF NOT EXISTS store_logo_url text DEFAULT '',
  ADD COLUMN IF NOT EXISTS country_image_url text DEFAULT '';

-- ─────────────────────────────────────────────────────────
-- Phase 5a — Review showcase cards
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  image_url text DEFAULT '',
  title text DEFAULT '',
  content_html text DEFAULT '',
  link_url text,
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc', now()),
  updated_at timestamptz DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_review_cards_sort ON public.review_cards(sort_order);
ALTER TABLE public.review_cards ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read review_cards" ON public.review_cards;
DROP POLICY IF EXISTS "Public write review_cards" ON public.review_cards;
CREATE POLICY "Public read review_cards" ON public.review_cards FOR SELECT USING (true);
CREATE POLICY "Public write review_cards" ON public.review_cards FOR ALL USING (true);

-- ─────────────────────────────────────────────────────────
-- Phase 5b — Ingredient tags (3 categories) + product join table
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.ingredient_tags (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL CHECK (category IN ('primary', 'functional', 'allergen')),
  name jsonb NOT NULL DEFAULT '{}'::jsonb,  -- { kr, en, cn, jp, vn, th }
  sort_order int DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc', now()),
  updated_at timestamptz DEFAULT timezone('utc', now())
);
CREATE INDEX IF NOT EXISTS idx_ingredient_tags_category ON public.ingredient_tags(category);

ALTER TABLE public.ingredient_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read ingredient_tags" ON public.ingredient_tags;
DROP POLICY IF EXISTS "Public write ingredient_tags" ON public.ingredient_tags;
CREATE POLICY "Public read ingredient_tags" ON public.ingredient_tags FOR SELECT USING (true);
CREATE POLICY "Public write ingredient_tags" ON public.ingredient_tags FOR ALL USING (true);

-- Many-to-many: products ↔ ingredient_tags
CREATE TABLE IF NOT EXISTS public.product_ingredient_tags (
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  tag_id     uuid NOT NULL REFERENCES public.ingredient_tags(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT timezone('utc', now()),
  PRIMARY KEY (product_id, tag_id)
);
CREATE INDEX IF NOT EXISTS idx_pit_product ON public.product_ingredient_tags(product_id);
CREATE INDEX IF NOT EXISTS idx_pit_tag     ON public.product_ingredient_tags(tag_id);

ALTER TABLE public.product_ingredient_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read product_ingredient_tags" ON public.product_ingredient_tags;
DROP POLICY IF EXISTS "Public write product_ingredient_tags" ON public.product_ingredient_tags;
CREATE POLICY "Public read product_ingredient_tags" ON public.product_ingredient_tags FOR SELECT USING (true);
CREATE POLICY "Public write product_ingredient_tags" ON public.product_ingredient_tags FOR ALL USING (true);
