-- ════════════════════════════════════════════════════════════════════
-- CAROUSEL: separate text_position for mobile
--
-- Until now each slide had a single text_position (migration 25) which
-- was applied across all breakpoints. That couples the desktop layout
-- (text on the left, product image on the right) with the mobile
-- rendering (full-bleed image + text overlay) — meaning if the admin
-- chose 'ml' to read well on desktop, mobile inherited the same anchor
-- and the text could land directly on top of the product.
--
-- This migration adds text_position_mobile so the admin can anchor the
-- text block independently per breakpoint:
--
--   text_position          (existing) → applied at sm+ (desktop / tablet)
--   text_position_mobile   (new)      → applied below sm (mobile)
--
-- Both default to 'mc'. Existing rows already have text_position='mc'
-- per migration 25's default; we backfill text_position_mobile to the
-- same so the public render is byte-identical until the admin touches
-- the new picker.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.carousel_slides
  ADD COLUMN IF NOT EXISTS text_position_mobile text NOT NULL DEFAULT 'mc';

-- Backfill any rows where text_position_mobile is still null (only
-- happens if the column existed before this migration with no default).
UPDATE public.carousel_slides
   SET text_position_mobile = 'mc'
 WHERE text_position_mobile IS NULL;
