-- ════════════════════════════════════════════════════════════════════
-- PHASE 3 RLS LOCKDOWN — content tables (products / posts / menus /
-- categories / comments).
--
-- These were all created via the Supabase SQL editor (not the migration
-- files), so their RLS state was unknown — likely either disabled
-- entirely or world-writable from the same era as the Phase 1/2 holes.
--
-- Pattern recap:
--
--   products, menus, categories
--     → public read + admin write (cosmetic admin-controlled content,
--       same shape as Phase 2's site_settings / carousel_slides / etc.)
--
--   posts
--     → public read + authenticated-user INSERT (must claim own
--       author_id) + author OR admin UPDATE/DELETE. The community
--       forum uses this; users write their own posts under their own
--       auth.uid().
--
--   comments
--     → public read + public INSERT + admin UPDATE/DELETE. Comments
--       are intentionally semi-anonymous in the current UX (the form
--       takes author_name as a free-text input, no signin required).
--       Future hardening: tie comments to auth.uid() and validate
--       is_admin_comment server-side via WITH CHECK — separate PR.
--
-- IMPORTANT — coordinated code change:
-- Six admin pages (admin/{products, products/_components/
-- ProductDetailModal, posts, menus, menus/[menuId]/posts, categories})
-- still use the bare anon supabase client. After this lockdown they'd
-- start getting 401s — same PR switches them to getSupabaseBrowser().
--
-- Frontend components that write to posts/comments
-- (PostActions, PostWritePage, CommentForm, CommentItem) already use
-- the session-aware client via @/lib/supabase/client (which is the
-- deprecated shim that re-exports getSupabaseBrowser).
-- ════════════════════════════════════════════════════════════════════

-- Same helper from Phase 2 — drop all existing policies on a table
-- before recreating, since some were created via SQL editor and we
-- don't know all the names.
CREATE OR REPLACE FUNCTION public._drop_all_policies(target_table text)
RETURNS void LANGUAGE plpgsql AS $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = target_table
  LOOP
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, target_table);
  END LOOP;
END $$;


-- ─── products / menus / categories — public read, admin write ──────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['products', 'menus', 'categories'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename = t
    ) THEN
      RAISE NOTICE 'skipping %; table does not exist', t;
      CONTINUE;
    END IF;

    PERFORM public._drop_all_policies(t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT USING (true)',
      t || '_public_read', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT WITH CHECK (public.is_admin())',
      t || '_admin_insert', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t || '_admin_update', t
    );
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE USING (public.is_admin())',
      t || '_admin_delete', t
    );
  END LOOP;
END $$;


-- ─── posts — public read, user-write-own, admin-write-any ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='posts'
  ) THEN
    RAISE NOTICE 'skipping posts; table does not exist';
    RETURN;
  END IF;

  PERFORM public._drop_all_policies('posts');
  ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

  -- Anyone can read posts (it's the public forum / blog feed).
  CREATE POLICY posts_public_read
    ON public.posts FOR SELECT
    USING (true);

  -- Authenticated users can write their own posts. WITH CHECK enforces
  -- that author_id matches auth.uid() — can't claim someone else's
  -- authorship. Admins bypass via the is_admin() OR branch.
  CREATE POLICY posts_user_insert
    ON public.posts FOR INSERT
    WITH CHECK (
      (auth.uid() IS NOT NULL AND auth.uid() = author_id)
      OR public.is_admin()
    );

  -- Users can edit their own posts (same author_id check on both sides
  -- of the row). Admins can edit anyone's.
  CREATE POLICY posts_user_update
    ON public.posts FOR UPDATE
    USING (
      (auth.uid() IS NOT NULL AND auth.uid() = author_id)
      OR public.is_admin()
    )
    WITH CHECK (
      (auth.uid() IS NOT NULL AND auth.uid() = author_id)
      OR public.is_admin()
    );

  -- Users delete their own, admin deletes any.
  CREATE POLICY posts_user_delete
    ON public.posts FOR DELETE
    USING (
      (auth.uid() IS NOT NULL AND auth.uid() = author_id)
      OR public.is_admin()
    );
END $$;


-- ─── comments — public read + public INSERT + admin write ──────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='comments'
  ) THEN
    RAISE NOTICE 'skipping comments; table does not exist';
    RETURN;
  END IF;

  PERFORM public._drop_all_policies('comments');
  ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

  CREATE POLICY comments_public_read
    ON public.comments FOR SELECT
    USING (true);

  -- Comments are semi-anonymous in the current UX (CommentForm takes
  -- a free-text author_name). Keep that capability — public INSERT.
  -- Hardening note: client sets is_admin_comment based on the cookie,
  -- which is spoofable. Future PR should add a WITH CHECK that requires
  -- public.is_admin() if is_admin_comment=true. Not done here to avoid
  -- breaking anonymous commenting.
  CREATE POLICY comments_public_insert
    ON public.comments FOR INSERT
    WITH CHECK (true);

  CREATE POLICY comments_admin_update
    ON public.comments FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

  CREATE POLICY comments_admin_delete
    ON public.comments FOR DELETE
    USING (public.is_admin());
END $$;


-- Cleanup
DROP FUNCTION public._drop_all_policies(text);
