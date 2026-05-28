-- Seed the `theme_tokens` site_settings row used by the new /admin/theme
-- editor + the [lang]/layout `<style>` injection.
--
-- Value shape (see src/lib/theme/tokens.ts):
--
--   {
--     "color_brand_ink": "#111111",
--     "color_brand_accent": "#d94a18",
--     "color_brand_muted": "#6b7280",
--     "color_brand_primary": "#00693a",
--     "color_brand_notice_from": "#4a7ab5",
--     "color_brand_notice_to": "#6b9fd4",
--     "radius_button": "0px",
--     "font_body": "",
--     "font_display": ""
--   }
--
-- Stored as a JSON-encoded string in site_settings.value (TEXT column).
-- Empty/null values fall through to the @theme defaults in globals.css.

INSERT INTO public.site_settings (key, value)
VALUES (
  'theme_tokens',
  '{"color_brand_ink":"#111111","color_brand_accent":"#d94a18","color_brand_muted":"#6b7280","color_brand_primary":"#00693a","color_brand_notice_from":"#4a7ab5","color_brand_notice_to":"#6b9fd4","radius_button":"0px","font_body":"","font_display":""}'
)
ON CONFLICT (key) DO NOTHING;
