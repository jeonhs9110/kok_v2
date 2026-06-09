-- Shorts section header — admin-editable title text + style. Boss
-- meeting 2026-06-10 asked for the "BRAND SHORTS" headline to be
-- both renamable and visually tunable (font size, text color, and
-- an optional solid background behind the title) so the brand can
-- swap in seasonal copy or a contrasting plate when needed.
--
-- All columns are nullable so the storefront falls back to the
-- pre-2026-06-10 hardcoded "BRAND SHORTS" / white-on-section-bg
-- look for installs where the admin hasn't touched the row.

ALTER TABLE public.shorts_config
  ADD COLUMN IF NOT EXISTS header_text       text,
  ADD COLUMN IF NOT EXISTS header_font_size  text,
  ADD COLUMN IF NOT EXISTS header_text_color text,
  ADD COLUMN IF NOT EXISTS header_bg_color   text;

COMMENT ON COLUMN public.shorts_config.header_text IS
  'Section title shown above the shorts carousel. NULL falls back to "BRAND SHORTS".';
COMMENT ON COLUMN public.shorts_config.header_font_size IS
  'CSS length (e.g. "18px"). NULL falls back to 15px.';
COMMENT ON COLUMN public.shorts_config.header_text_color IS
  'CSS color (e.g. "#ffffff"). NULL falls back to white.';
COMMENT ON COLUMN public.shorts_config.header_bg_color IS
  'Optional solid background behind the title (e.g. "#000000"). NULL renders the title flush against the section background.';
