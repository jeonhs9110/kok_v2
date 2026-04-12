-- ============================================================
-- KOKKOK GARDEN V2 — Homepage Redesign Migration
-- Run this in Supabase → SQL Editor
-- ============================================================

-- Instagram config & posts tables
CREATE TABLE IF NOT EXISTS public.instagram_config (
  id integer PRIMARY KEY DEFAULT 1,
  handle text DEFAULT 'rdrd_official',
  description text DEFAULT '인스타그램에서 최신 소식을 확인하세요',
  updated_at timestamptz DEFAULT timezone('utc', now()),
  CONSTRAINT single_row CHECK (id = 1)
);
INSERT INTO public.instagram_config (id, handle, description)
VALUES (1, 'rdrd_official', '인스타그램에서 최신 소식을 확인하세요')
ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.instagram_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read instagram_config" ON public.instagram_config;
DROP POLICY IF EXISTS "Public write instagram_config" ON public.instagram_config;
CREATE POLICY "Public read instagram_config" ON public.instagram_config FOR SELECT USING (true);
CREATE POLICY "Public write instagram_config" ON public.instagram_config FOR ALL USING (true);

CREATE TABLE IF NOT EXISTS public.instagram_posts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url text NOT NULL DEFAULT '',
  link_url text DEFAULT '',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc', now())
);
ALTER TABLE public.instagram_posts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read instagram_posts" ON public.instagram_posts;
DROP POLICY IF EXISTS "Public write instagram_posts" ON public.instagram_posts;
CREATE POLICY "Public read instagram_posts" ON public.instagram_posts FOR SELECT USING (true);
CREATE POLICY "Public write instagram_posts" ON public.instagram_posts FOR ALL USING (true);

-- 0. Add link_url to carousel_slides
ALTER TABLE public.carousel_slides ADD COLUMN IF NOT EXISTS link_url text DEFAULT NULL;

-- 1. Add is_best_seller flag to products
ALTER TABLE public.products ADD COLUMN IF NOT EXISTS is_best_seller boolean DEFAULT false;

-- 2. Promo banners table (2 side-by-side clickable banners)
CREATE TABLE IF NOT EXISTS public.promo_banners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url text NOT NULL DEFAULT '',
  link_url text DEFAULT '#',
  sort_order integer DEFAULT 0,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc', now())
);
ALTER TABLE public.promo_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read promo_banners" ON public.promo_banners;
DROP POLICY IF EXISTS "Public write promo_banners" ON public.promo_banners;
CREATE POLICY "Public read promo_banners" ON public.promo_banners FOR SELECT USING (true);
CREATE POLICY "Public write promo_banners" ON public.promo_banners FOR ALL USING (true);

-- 3. Sub hero banner table (full-width secondary banner)
CREATE TABLE IF NOT EXISTS public.sub_hero_banners (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  image_url text NOT NULL DEFAULT '',
  link_url text DEFAULT '#',
  title text DEFAULT '',
  subtitle text DEFAULT '',
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT timezone('utc', now())
);
ALTER TABLE public.sub_hero_banners ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read sub_hero_banners" ON public.sub_hero_banners;
DROP POLICY IF EXISTS "Public write sub_hero_banners" ON public.sub_hero_banners;
CREATE POLICY "Public read sub_hero_banners" ON public.sub_hero_banners FOR SELECT USING (true);
CREATE POLICY "Public write sub_hero_banners" ON public.sub_hero_banners FOR ALL USING (true);

-- 4. Add product_id to shorts (for click-to-product-page feature)
ALTER TABLE public.shorts ADD COLUMN IF NOT EXISTS product_id uuid REFERENCES public.products(id) ON DELETE SET NULL;

-- 5. Product submenu categories (유형별 / 성분별 / 피부고민별)
-- NOTE: Run only if these categories do not already exist
INSERT INTO public.categories (name, slug, parent_id, sort_order, is_active)
VALUES
  ('{"kr": "유형별", "en": "By Type"}', 'by-type', null, 10, true),
  ('{"kr": "성분별", "en": "By Ingredient"}', 'by-ingredient', null, 20, true),
  ('{"kr": "피부고민별", "en": "By Skin Concern"}', 'by-skin-concern', null, 30, true)
ON CONFLICT (slug) DO NOTHING;

-- 6. Navigation menus — Brand Story & Event & Notice with submenus
-- Insert parent menus (skip if already exist)
INSERT INTO public.menus (slug, title, page_type, show_in_nav, sort_order, is_published)
VALUES
  ('brand-story',   '{"kr": "Brand Story", "en": "Brand Story"}',     'board', true, 20, true),
  ('event-notice',  '{"kr": "Event & Notice", "en": "Event & Notice"}', 'board', true, 30, true),
  ('review',        '{"kr": "Review & Community", "en": "Review & Community"}', 'board', true, 40, true)
ON CONFLICT (slug) DO NOTHING;

-- Insert Brand Story children (kokkok garden Story / Ingredients)
INSERT INTO public.menus (slug, title, parent_id, page_type, show_in_nav, sort_order, is_published)
SELECT 'brand-story-kokkok', '{"kr": "kokkok garden Story", "en": "kokkok garden Story"}',
       id, 'page', true, 1, true
FROM public.menus WHERE slug = 'brand-story'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.menus (slug, title, parent_id, page_type, show_in_nav, sort_order, is_published)
SELECT 'brand-story-ingredients', '{"kr": "Ingredients", "en": "Ingredients"}',
       id, 'page', true, 2, true
FROM public.menus WHERE slug = 'brand-story'
ON CONFLICT (slug) DO NOTHING;

-- Insert Event & Notice children (Event / Notice / Contact / Q&A)
INSERT INTO public.menus (slug, title, parent_id, page_type, show_in_nav, sort_order, is_published)
SELECT 'event', '{"kr": "Event", "en": "Event"}', id, 'board', true, 1, true
FROM public.menus WHERE slug = 'event-notice'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.menus (slug, title, parent_id, page_type, show_in_nav, sort_order, is_published)
SELECT 'notice', '{"kr": "Notice", "en": "Notice"}', id, 'board', true, 2, true
FROM public.menus WHERE slug = 'event-notice'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.menus (slug, title, parent_id, page_type, show_in_nav, sort_order, is_published)
SELECT 'contact', '{"kr": "Contact", "en": "Contact"}', id, 'page', true, 3, true
FROM public.menus WHERE slug = 'event-notice'
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.menus (slug, title, parent_id, page_type, show_in_nav, sort_order, is_published)
SELECT 'qna', '{"kr": "Q&A", "en": "Q&A"}', id, 'board', true, 4, true
FROM public.menus WHERE slug = 'event-notice'
ON CONFLICT (slug) DO NOTHING;
