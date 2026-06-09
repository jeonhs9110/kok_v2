-- Sub-hero gets the same image focal-point picker the carousel got in
-- migration 30. Lets the admin click the precise point in the source
-- image that should stay in view when the wide-source banner crops
-- down to portrait on mobile.

ALTER TABLE public.sub_hero_banners
  ADD COLUMN IF NOT EXISTS image_anchor jsonb,
  ADD COLUMN IF NOT EXISTS image_anchor_mobile jsonb;

COMMENT ON COLUMN public.sub_hero_banners.image_anchor IS
  '{ "x": 0-100, "y": 0-100 } percent for desktop object-position focal point.';
COMMENT ON COLUMN public.sub_hero_banners.image_anchor_mobile IS
  '{ "x": 0-100, "y": 0-100 } percent for mobile object-position focal point.';
