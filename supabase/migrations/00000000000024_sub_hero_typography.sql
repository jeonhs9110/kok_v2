-- ════════════════════════════════════════════════════════════════════
-- SUB-HERO TYPOGRAPHY COLUMNS
--
-- Phase 2 of the admin "make every text-over-image editable" feature.
-- The sub-hero banner previously gave the admin only image + title +
-- subtitle + size offset. This adds the rest of the typography surface
-- the admin needed: font family, weight (bold), italic, underline,
-- color, and a 9-cell text position picker (top/middle/bottom × left/
-- center/right).
--
-- All columns are nullable with sensible defaults so existing rows keep
-- rendering the way they always did — the SubHeroBanner component
-- treats null as "use the legacy default" (centered, brand font,
-- white drop-shadowed text, no decoration).
--
-- Phase 3 (carousel_slides) will mirror this column set so the same
-- shared TypographyPanel component drives both editors.
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.sub_hero_banners
  ADD COLUMN IF NOT EXISTS title_font_family    text,
  ADD COLUMN IF NOT EXISTS subtitle_font_family text,
  ADD COLUMN IF NOT EXISTS title_bold           boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS title_italic         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title_underline      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtitle_bold        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtitle_italic      boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS subtitle_underline   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS title_color          text,
  ADD COLUMN IF NOT EXISTS subtitle_color       text,
  -- 9-cell anchor: 'tl' 'tc' 'tr' 'ml' 'mc' 'mr' 'bl' 'bc' 'br'.
  -- Constrained at the app level (shared constants); kept as a free
  -- text column so a future "free drag" mode can encode a percentage
  -- pair like '37,82' here without a schema change.
  ADD COLUMN IF NOT EXISTS text_position        text NOT NULL DEFAULT 'mc';
