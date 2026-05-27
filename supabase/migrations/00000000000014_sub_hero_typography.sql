-- Adds typography controls to sub-hero banner, mirroring the carousel pattern.
-- Sizes are stored as +/- offsets in px relative to the default size.
--   - title    base: 48px (matches `md:text-5xl` in SubHeroBanner)
--   - subtitle base: 16px (matches `md:text-base` in SubHeroBanner)

ALTER TABLE public.sub_hero_banners
  ADD COLUMN IF NOT EXISTS title_size_offset    INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtitle_size_offset INTEGER DEFAULT 0;
