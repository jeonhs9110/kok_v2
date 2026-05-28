-- ════════════════════════════════════════════════════════════════════
-- PHASE 4 RLS LOCKDOWN — the tables I missed in Phases 1–3.
--
-- Audit caught 5 tables that should have been in scope earlier:
--
--   users              — PRIVILEGE ESCALATION SURFACE. If anon (or any
--                        signed-in user) could `UPDATE users SET
--                        role='admin' WHERE id=auth.uid()`, every
--                        is_admin()-gated policy in the rest of the
--                        DB becomes meaningless. Lock down hard.
--
--   wishlist           — user-scoped data. Anyone could read everyone's
--                        wishlist if RLS was open.
--
--   pages              — admin-managed site pages (About, etc.). Same
--                        pattern as menus / categories: public read,
--                        admin write.
--
--   analytics          — tracking events. Public INSERT (the /api/track
--                        route writes from anon visitors); admin SELECT.
--
--   instagram_config   — admin-managed handle / RSS URL. Public read
--                        (used on the homepage IG section); admin write.
--
-- After this migration, the followups list has zero known
-- world-writable tables across the entire public schema.
--
-- Coordinated code change:
-- admin/users, admin/pages, wishlist/WishlistContext all use the bare
-- anon client and would 401 once these bite. Same PR switches them to
-- getSupabaseBrowser().
-- ════════════════════════════════════════════════════════════════════

-- Recreate the admin helper if it got dropped at some point (Phase 3
-- discovered the function had vanished between Phase 1 and Phase 3 —
-- defensive idempotent recreate so policies referencing it never break).
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

-- Drop-all-policies helper (used + dropped at the end)
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


-- ─── users — self read, admin rw, NO self-write ────────────────────
-- Critical: omitting any self-write policy means even authenticated
-- users cannot UPDATE their own row. is_admin() is calculated from
-- this table's `role` column, so allowing self-write would re-open
-- the privilege escalation path the whole system depends on closing.
-- Profile-editable fields (name, phone, etc.) live in customer_profiles
-- which has its own self_update policy from Phase 1.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='users') THEN
    RAISE NOTICE 'skipping users; table does not exist'; RETURN;
  END IF;
  PERFORM public._drop_all_policies('users');
  ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

  -- Login needs this to read its own row's role
  CREATE POLICY users_self_read
    ON public.users FOR SELECT
    USING (auth.uid() = id);

  CREATE POLICY users_admin_read
    ON public.users FOR SELECT
    USING (public.is_admin());

  CREATE POLICY users_admin_insert
    ON public.users FOR INSERT
    WITH CHECK (public.is_admin());

  CREATE POLICY users_admin_update
    ON public.users FOR UPDATE
    USING (public.is_admin())
    WITH CHECK (public.is_admin());

  CREATE POLICY users_admin_delete
    ON public.users FOR DELETE
    USING (public.is_admin());
END $$;


-- ─── wishlist — self RW + admin read ───────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='wishlist') THEN
    RAISE NOTICE 'skipping wishlist; table does not exist'; RETURN;
  END IF;
  PERFORM public._drop_all_policies('wishlist');
  ALTER TABLE public.wishlist ENABLE ROW LEVEL SECURITY;

  CREATE POLICY wishlist_self_read
    ON public.wishlist FOR SELECT
    USING (auth.uid() = user_id);

  CREATE POLICY wishlist_self_insert
    ON public.wishlist FOR INSERT
    WITH CHECK (auth.uid() = user_id);

  CREATE POLICY wishlist_self_delete
    ON public.wishlist FOR DELETE
    USING (auth.uid() = user_id);

  -- Admin dashboard needs to count wishlist entries across users
  CREATE POLICY wishlist_admin_read
    ON public.wishlist FOR SELECT
    USING (public.is_admin());
END $$;


-- ─── pages — public read + admin write ─────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='pages') THEN
    RAISE NOTICE 'skipping pages; table does not exist'; RETURN;
  END IF;
  PERFORM public._drop_all_policies('pages');
  ALTER TABLE public.pages ENABLE ROW LEVEL SECURITY;
  CREATE POLICY pages_public_read   ON public.pages FOR SELECT USING (true);
  CREATE POLICY pages_admin_insert  ON public.pages FOR INSERT WITH CHECK (public.is_admin());
  CREATE POLICY pages_admin_update  ON public.pages FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
  CREATE POLICY pages_admin_delete  ON public.pages FOR DELETE USING (public.is_admin());
END $$;


-- ─── analytics — public INSERT (track events) + admin read ─────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='analytics') THEN
    RAISE NOTICE 'skipping analytics; table does not exist'; RETURN;
  END IF;
  PERFORM public._drop_all_policies('analytics');
  ALTER TABLE public.analytics ENABLE ROW LEVEL SECURITY;

  -- /api/track route writes from anonymous visitors
  CREATE POLICY analytics_public_insert
    ON public.analytics FOR INSERT
    WITH CHECK (true);

  -- Admin dashboard reads aggregate stats
  CREATE POLICY analytics_admin_read
    ON public.analytics FOR SELECT
    USING (public.is_admin());

  CREATE POLICY analytics_admin_delete
    ON public.analytics FOR DELETE
    USING (public.is_admin());
  -- No UPDATE policy — analytics rows are append-only.
END $$;


-- ─── instagram_config — public read + admin write ──────────────────
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='instagram_config') THEN
    RAISE NOTICE 'skipping instagram_config; table does not exist'; RETURN;
  END IF;
  PERFORM public._drop_all_policies('instagram_config');
  ALTER TABLE public.instagram_config ENABLE ROW LEVEL SECURITY;
  CREATE POLICY instagram_config_public_read   ON public.instagram_config FOR SELECT USING (true);
  CREATE POLICY instagram_config_admin_insert  ON public.instagram_config FOR INSERT WITH CHECK (public.is_admin());
  CREATE POLICY instagram_config_admin_update  ON public.instagram_config FOR UPDATE USING (public.is_admin()) WITH CHECK (public.is_admin());
  CREATE POLICY instagram_config_admin_delete  ON public.instagram_config FOR DELETE USING (public.is_admin());
END $$;


DROP FUNCTION public._drop_all_policies(text);
