-- Carousel hero — separate PC vs mobile image upload. Boss meeting
-- 2026-06-10 asked for the option to upload a portrait-friendly mobile
-- composition without losing the wide PC image. Until now the desktop
-- file got cropped by the mobile breakpoint's tall aspect ratio.
--
-- The column is nullable: if no mobile image is uploaded, the
-- storefront falls back to image_url at every breakpoint (matching
-- pre-2026-06-10 behavior on existing rows).

ALTER TABLE public.carousel_slides
  ADD COLUMN IF NOT EXISTS mobile_image_url text;

COMMENT ON COLUMN public.carousel_slides.mobile_image_url IS
  'Optional mobile-specific hero image. NULL falls back to image_url. HeroSlider swaps via the sm breakpoint.';
