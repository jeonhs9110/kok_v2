-- ════════════════════════════════════════════════════════════════════
-- PHASE 5 — Supabase Storage bucket RLS lockdown.
--
-- Phases 1–4 locked down every table in the `public` schema. But the
-- file uploads (carousel images, product photos, banner images, the
-- site logo, etc.) live in Supabase Storage buckets, which have their
-- own RLS on `storage.objects` — separate from table RLS.
--
-- Current state, per `supabase/migrations/00000000000005_phase2_to_5.sql`:
--
--   CREATE POLICY "site-assets public write" ON storage.objects
--     FOR ALL USING (bucket_id = 'site-assets');
--
-- That's `USING (bucket_id = 'site-assets')` with no auth check —
-- meaning anyone with the anon key (public!) can:
--
--   - Upload arbitrary files to site-assets (free image hosting for
--     warez / spam → racks up Supabase Storage bills)
--   - Delete the site logo, replace it with anything
--   - Overwrite product images, carousel slides, banners
--   - Upload malicious files referenced via the bucket's public URLs
--
-- The `product-images` bucket has no explicit policy in our migrations
-- — Supabase's default policies on storage.objects are either deny-all
-- or wide-open depending on bucket settings. Either way, we want
-- explicit admin-only writes.
--
-- After this migration:
--   - Both buckets: public SELECT (storefront needs to display files)
--   - Both buckets: admin-only INSERT / UPDATE / DELETE via
--     is_admin() — same helper Phase 1–4 use.
--
-- Coordinated code: no changes needed. All admin upload code paths
-- already use the session-aware `getSupabaseBrowser()` client from
-- the Phase 1–4 swaps, so their requests include the admin JWT.
-- ════════════════════════════════════════════════════════════════════

-- Defensive recreate of is_admin() in case Phase 4's idempotent
-- create-or-replace was the only thing keeping it alive.
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;


-- Make sure both buckets exist + are marked public (for read URLs).
INSERT INTO storage.buckets (id, name, public)
VALUES
  ('site-assets', 'site-assets', true),
  ('product-images', 'product-images', true)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;


-- ─── Drop every existing policy on storage.objects that targets our
--     two buckets, so we start clean. Other buckets (auth avatars etc.)
--     keep whatever policies they have.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname='storage' AND tablename='objects'
      AND policyname IN (
        'site-assets public read',
        'site-assets public write',
        'product-images public read',
        'product-images public write',
        'site-assets read',
        'site-assets admin insert',
        'site-assets admin update',
        'site-assets admin delete',
        'product-images read',
        'product-images admin insert',
        'product-images admin update',
        'product-images admin delete'
      )
  LOOP
    EXECUTE format('DROP POLICY %I ON storage.objects', r.policyname);
  END LOOP;
END $$;


-- ─── site-assets: public read + admin write ────────────────────────
CREATE POLICY "site-assets read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'site-assets');

CREATE POLICY "site-assets admin insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());

CREATE POLICY "site-assets admin update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'site-assets' AND public.is_admin())
  WITH CHECK (bucket_id = 'site-assets' AND public.is_admin());

CREATE POLICY "site-assets admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'site-assets' AND public.is_admin());


-- ─── product-images: public read + admin write ─────────────────────
CREATE POLICY "product-images read"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'product-images');

CREATE POLICY "product-images admin insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product-images admin update"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'product-images' AND public.is_admin())
  WITH CHECK (bucket_id = 'product-images' AND public.is_admin());

CREATE POLICY "product-images admin delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'product-images' AND public.is_admin());
