-- Instagram section header — style the @handle line displayed above
-- the post grid. Boss meeting 2026-06-10 asked for the same trio of
-- knobs we just gave the Shorts section: font size, text color, and
-- an optional solid background plate behind the handle.
--
-- The handle text itself is already admin-editable via
-- instagram_config.handle, so we only need the three style columns
-- here. All nullable — NULL falls back to the pre-2026-06-10
-- hardcoded look (text-lg / neutral-800 / no plate).

ALTER TABLE public.instagram_config
  ADD COLUMN IF NOT EXISTS header_font_size  text,
  ADD COLUMN IF NOT EXISTS header_text_color text,
  ADD COLUMN IF NOT EXISTS header_bg_color   text;

COMMENT ON COLUMN public.instagram_config.header_font_size IS
  'CSS length (e.g. "20px"). NULL falls back to 18px (text-lg).';
COMMENT ON COLUMN public.instagram_config.header_text_color IS
  'CSS color for @handle. NULL falls back to neutral-800.';
COMMENT ON COLUMN public.instagram_config.header_bg_color IS
  'Optional solid background behind the handle. NULL renders the handle flush against the section background.';
