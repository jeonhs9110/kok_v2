-- Homepage inline banners — operator-controllable single-line strips
-- that live BETWEEN homepage sections (not the global top stripe).
-- Cafe24-style event/promo strips the operator can spawn anywhere in
-- the section order: above the carousel, between products and shorts,
-- right above Instagram, wherever. The section_order row carries
-- 'banner:<uuid>' entries pointing at rows here.
--
-- Difference from site_settings.top_stripe (migration 36):
--   - top_stripe: 1 row, global site chrome above <Header/> on every page
--   - homepage_banners: N rows, inline strips on the homepage only
--
-- Reorder/insert is driven entirely by site_settings.homepage_section_order
-- (migration 37). Banner rows have no sort_order column — the source
-- of truth for placement is the order array.

CREATE TABLE IF NOT EXISTS public.homepage_banners (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text JSONB NOT NULL DEFAULT '{}'::jsonb,
  link_url TEXT,
  bg_color TEXT NOT NULL DEFAULT '#1f2937',
  text_color TEXT NOT NULL DEFAULT '#ffffff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.homepage_banners ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS homepage_banners_public_read   ON public.homepage_banners;
DROP POLICY IF EXISTS homepage_banners_admin_insert  ON public.homepage_banners;
DROP POLICY IF EXISTS homepage_banners_admin_update  ON public.homepage_banners;
DROP POLICY IF EXISTS homepage_banners_admin_delete  ON public.homepage_banners;

CREATE POLICY homepage_banners_public_read
  ON public.homepage_banners FOR SELECT
  USING (true);

CREATE POLICY homepage_banners_admin_insert
  ON public.homepage_banners FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY homepage_banners_admin_update
  ON public.homepage_banners FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY homepage_banners_admin_delete
  ON public.homepage_banners FOR DELETE
  USING (public.is_admin());
