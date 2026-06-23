-- Carousel slides: per-element text shadow.
--
-- One nullable INT column per element. NULL means "no shadow" — the
-- storefront skips emitting the text-shadow CSS entirely so legacy rows
-- match the pre-migration look exactly. A value 0–100 is treated as the
-- shadow intensity dial the admin sets via the slider:
--
--   text-shadow: 0 2px (depth / 6)px rgba(0, 0, 0, depth / 100)
--
-- Picked the dial range over a bool + separate depth column so the form
-- maps cleanly: checkbox "그림자 적용" toggles NULL↔last value; slider
-- writes the depth directly.
ALTER TABLE public.carousel_slides
  ADD COLUMN IF NOT EXISTS badge_shadow_depth    integer,
  ADD COLUMN IF NOT EXISTS title_shadow_depth    integer,
  ADD COLUMN IF NOT EXISTS subtitle_shadow_depth integer;

-- Soft bound on the depth so a stray write can't paint a ridiculous
-- shadow. NULL bypasses the constraint per SQL semantics.
ALTER TABLE public.carousel_slides
  ADD CONSTRAINT carousel_slides_badge_shadow_depth_range
    CHECK (badge_shadow_depth    IS NULL OR badge_shadow_depth    BETWEEN 0 AND 100),
  ADD CONSTRAINT carousel_slides_title_shadow_depth_range
    CHECK (title_shadow_depth    IS NULL OR title_shadow_depth    BETWEEN 0 AND 100),
  ADD CONSTRAINT carousel_slides_subtitle_shadow_depth_range
    CHECK (subtitle_shadow_depth IS NULL OR subtitle_shadow_depth BETWEEN 0 AND 100);
