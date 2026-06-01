-- ════════════════════════════════════════════════════════════════════
-- CAROUSEL SLIDES TYPOGRAPHY COLUMNS
--
-- Phase 3 of the "admin can shape every text-over-image" feature
-- (mirrors migration 00000000000024 on sub_hero_banners). Each slide
-- gains a font family + bold / italic / underline trio for each of
-- its three text blocks (badge, title, subtitle), plus a single
-- text_position anchor that places the whole text block inside the
-- slide. The slide's existing text_color / badge_text_color /
-- *_size_offset columns are unchanged — admins now layer face / weight
-- / italics / underline / 9-cell anchor on top of those.
--
-- All booleans default to false so existing slides keep the previous
-- look (no italics, no underline; bold comes from the heading element's
-- font-weight as it always has). text_position defaults to 'mc' which
-- maps to the legacy center-of-slide layout in HeroSlider.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.carousel_slides
  ADD COLUMN IF NOT EXISTS badge_font_family    text,
  ADD COLUMN IF NOT EXISTS title_font_family    text,
  ADD COLUMN IF NOT EXISTS subtitle_font_family text,

  ADD COLUMN IF NOT EXISTS badge_bold        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS badge_italic      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS badge_underline   boolean NOT NULL DEFAULT false,

  ADD COLUMN IF NOT EXISTS title_bold        boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS title_italic      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title_underline   boolean NOT NULL DEFAULT false,

  ADD COLUMN IF NOT EXISTS subtitle_bold     boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtitle_italic   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtitle_underline boolean NOT NULL DEFAULT false,

  -- 9-cell anchor: 'tl' 'tc' 'tr' 'ml' 'mc' 'mr' 'bl' 'bc' 'br'.
  -- See migration 00000000000024 for the column-shape rationale.
  ADD COLUMN IF NOT EXISTS text_position     text NOT NULL DEFAULT 'mc';
