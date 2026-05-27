-- Adds typography + color controls to carousel slides for the main banner editor.
-- Sizes are stored as +/- offsets in px relative to the default size to keep
-- backwards-compatible defaults of 0.

ALTER TABLE carousel_slides
  ADD COLUMN IF NOT EXISTS text_color TEXT DEFAULT '#111111',
  ADD COLUMN IF NOT EXISTS badge_bg_color TEXT DEFAULT '#333333',
  ADD COLUMN IF NOT EXISTS badge_text_color TEXT DEFAULT '#FFFFFF',
  ADD COLUMN IF NOT EXISTS title_size_offset INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS subtitle_size_offset INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS badge_size_offset INTEGER DEFAULT 0;
