-- ════════════════════════════════════════════════════════════════════
-- CAROUSEL: per-breakpoint image focal point
--
-- Admin uploaded slide images are authored for desktop (product on the
-- right, text on the left). When mobile shrinks the wide source to a
-- ~9:14 portrait box with object-cover + object-center, the product
-- can get cropped off-frame entirely. PR #80 tried to fix this with a
-- hardcoded object-right on mobile; PR #92 reverted that because the
-- shift looked wrong on slides where the focal subject WASN'T on the
-- right. The real answer is to let the admin pick the focal point per
-- breakpoint.
--
-- These two columns mirror the text-position pair from migrations 25 +
-- 27: each holds a 9-cell anchor key ('tl' 'tc' 'tr' 'ml' 'mc' 'mr'
-- 'bl' 'bc' 'br'). The HeroSlider render maps the value to a CSS
-- `object-position` (e.g. 'tl' → 'left top', 'mr' → 'right center').
--
-- Both default to 'mc' so existing rows keep rendering with center
-- crop on both breakpoints — same as the post-PR-92 behavior. The
-- admin only sees a behavior change after explicitly picking a
-- different anchor.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.carousel_slides
  ADD COLUMN IF NOT EXISTS image_position        text NOT NULL DEFAULT 'mc',
  ADD COLUMN IF NOT EXISTS image_position_mobile text NOT NULL DEFAULT 'mc';

-- Defensive backfill — same idea as the text-position migrations.
UPDATE public.carousel_slides
   SET image_position = 'mc'
 WHERE image_position IS NULL;

UPDATE public.carousel_slides
   SET image_position_mobile = 'mc'
 WHERE image_position_mobile IS NULL;
