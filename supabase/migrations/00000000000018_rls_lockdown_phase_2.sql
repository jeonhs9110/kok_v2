-- ════════════════════════════════════════════════════════════════════
-- PHASE 2 RLS LOCKDOWN — admin-controlled cosmetic + config tables.
--
-- After Phase 1 closed the PII hole on customer_profiles + auth config,
-- this PR closes the same kind of `USING (true)` lies on every other
-- admin-controlled table:
--
--   site_settings, site_backgrounds, review_cards, ingredient_tags,
--   product_ingredient_tags, worldwide_labels, worldwide_retailers,
--   carousel_slides, shorts, sub_hero_banners, promo_banners,
--   instagram_posts, chatbot_config, chatbot_leads,
--   payment_providers_config
--
-- Without these, anyone with the anon key (publicly visible) could:
--   - Swap the site logo (site_settings)
--   - Inject fake product reviews (review_cards)
--   - Modify which countries / vendors appear on /worldwide
--   - Add/remove carousel slides, hero banners, promos, IG posts
--   - Read payment provider API keys (payment_providers_config)
--   - Read all chatbot conversation leads
--
-- After this migration, the public site still SELECTs all of these
-- (storefront read paths unchanged), and admin pages still INSERT/
-- UPDATE/DELETE — but admin writes now require the signed-in user
-- to satisfy public.is_admin() (helper from migration 17).
--
-- IMPORTANT — coordinated code change:
-- 15 admin pages were calling Supabase via the bare anon client
-- (no session attached) and would start getting 401s once these
-- policies bite. The same PR switches them all to getSupabaseBrowser()
-- from @supabase/ssr so the admin's JWT rides along with each request.
--
-- The two tables that already had correct admin-write checks via
-- (auth.uid() IN (SELECT id FROM users WHERE role='admin')) —
-- legal_pages and business_info — are NOT touched. They work as-is.
-- ════════════════════════════════════════════════════════════════════

-- ── Helper: drop every existing policy on a table. We use this
--    instead of a long list of "DROP POLICY IF EXISTS <name>"
--    because some of these tables were created via the Supabase SQL
--    editor (not the migration files), so we can't know all the
--    policy names ahead of time. Cleanest path is reset + recreate.
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


-- ─── Pattern A: public read + admin write ───────────────────────────
-- Applies to anything the storefront renders to anonymous visitors.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'site_settings',
    'site_backgrounds',
    'review_cards',
    'ingredient_tags',
    'product_ingredient_tags',
    'worldwide_labels',
    'worldwide_retailers',
    'carousel_slides',
    'shorts',
    'sub_hero_banners',
    'promo_banners',
    'instagram_posts',
    'chatbot_config'
  ] LOOP
    -- Skip silently if the table doesn't exist in this environment
    -- (some prod-only tables aren't in every branch's schema).
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
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


-- ─── Pattern B: admin-only (sensitive — API keys, internal data) ────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['payment_providers_config'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = t
    ) THEN
      RAISE NOTICE 'skipping %; table does not exist', t;
      CONTINUE;
    END IF;

    PERFORM public._drop_all_policies(t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())',
      t || '_admin_all', t
    );
  END LOOP;
END $$;


-- ─── chatbot_leads — public INSERT (chat widget submits leads),
--    admin reads them. Public should NOT be able to read other
--    visitors' leads or modify any.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='chatbot_leads'
  ) THEN
    RAISE NOTICE 'skipping chatbot_leads; table does not exist';
    RETURN;
  END IF;

  PERFORM public._drop_all_policies('chatbot_leads');
  ALTER TABLE public.chatbot_leads ENABLE ROW LEVEL SECURITY;

  CREATE POLICY chatbot_leads_public_insert
    ON public.chatbot_leads FOR INSERT
    WITH CHECK (true);

  CREATE POLICY chatbot_leads_admin_read
    ON public.chatbot_leads FOR SELECT
    USING (public.is_admin());

  CREATE POLICY chatbot_leads_admin_update
    ON public.chatbot_leads FOR UPDATE
    USING (public.is_admin()) WITH CHECK (public.is_admin());

  CREATE POLICY chatbot_leads_admin_delete
    ON public.chatbot_leads FOR DELETE
    USING (public.is_admin());
END $$;


-- Clean up the helper — it served its purpose for this migration.
DROP FUNCTION public._drop_all_policies(text);
