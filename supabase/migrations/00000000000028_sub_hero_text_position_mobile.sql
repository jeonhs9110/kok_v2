-- ════════════════════════════════════════════════════════════════════
-- SUB-HERO: separate text_position for mobile
--
-- Symmetric to migration 27 on carousel_slides. The sub-hero banner has
-- had a single text_position column since migration 24, applied at
-- every breakpoint. That meant if the admin chose 'mc' to look right on
-- desktop, mobile inherited the same anchor — and on a narrow phone the
-- text could land on top of the product image.
--
-- text_position          (existing) → applied at md+ (desktop / tablet)
-- text_position_mobile   (new)      → applied below md (mobile)
--
-- Both default to 'mc'; existing rows already carry 'mc' for
-- text_position, so backfilling text_position_mobile to the same value
-- preserves the current render until the admin touches the new picker.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.sub_hero_banners
  ADD COLUMN IF NOT EXISTS text_position_mobile text NOT NULL DEFAULT 'mc';

UPDATE public.sub_hero_banners
   SET text_position_mobile = 'mc'
 WHERE text_position_mobile IS NULL;
