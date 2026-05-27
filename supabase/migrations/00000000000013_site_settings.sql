-- ============================================================
-- KOKKOK GARDEN V2 — Site-wide settings (logo, etc.)
-- Phase 2 (#9): Admin-managed logo
-- Run in Supabase → SQL Editor
-- ============================================================

-- Single-row key/value table. Key is a stable identifier.
-- Value stores a URL, text, or JSON string depending on the key.
CREATE TABLE IF NOT EXISTS public.site_settings (
  key text PRIMARY KEY,
  value text DEFAULT '',
  updated_at timestamptz DEFAULT timezone('utc', now())
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read site_settings" ON public.site_settings;
DROP POLICY IF EXISTS "Public write site_settings" ON public.site_settings;
CREATE POLICY "Public read site_settings" ON public.site_settings FOR SELECT USING (true);
CREATE POLICY "Public write site_settings" ON public.site_settings FOR ALL USING (true);

-- Seed empty logo slot so admin can upload one
INSERT INTO public.site_settings (key, value) VALUES
  ('logo_url', '')
ON CONFLICT (key) DO NOTHING;

-- Create a public storage bucket for site-level assets (logo, etc.)
-- You can also run this manually in Storage → Create bucket (name: site-assets, public).
INSERT INTO storage.buckets (id, name, public)
VALUES ('site-assets', 'site-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Open policies on the bucket so anon key can upload / read
DROP POLICY IF EXISTS "site-assets public read" ON storage.objects;
DROP POLICY IF EXISTS "site-assets public write" ON storage.objects;
CREATE POLICY "site-assets public read" ON storage.objects
  FOR SELECT USING (bucket_id = 'site-assets');
CREATE POLICY "site-assets public write" ON storage.objects
  FOR ALL USING (bucket_id = 'site-assets');
