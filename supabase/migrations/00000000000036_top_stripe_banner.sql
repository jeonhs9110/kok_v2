-- Top stripe banner — a thin sticky band at the very top of every page
-- (above the header) showing a short admin-editable promotional message.
-- Operator's 2026-06-17 ask after seeing the equivalent on Cafe24
-- ("첫 쇼핑을 지원하는 3,000원 할인 회원가입 쿠폰"-style).
--
-- Stored as a single site_settings row keyed 'top_stripe' with a JSON
-- value. Lives in site_settings rather than its own table because it's
-- a singleton config — same pattern theme_tokens uses.
--
-- value shape (JSON):
-- {
--   "is_active": true,
--   "text": "첫 쇼핑을 지원하는 3,000원 할인 회원가입 쿠폰",
--   "link_url": "/register",
--   "bg_color": "#1f2937",
--   "text_color": "#ffffff"
-- }

INSERT INTO public.site_settings (key, value)
VALUES (
  'top_stripe',
  '{"is_active":false,"text":"","link_url":"","bg_color":"#1f2937","text_color":"#ffffff"}'
)
ON CONFLICT (key) DO NOTHING;
