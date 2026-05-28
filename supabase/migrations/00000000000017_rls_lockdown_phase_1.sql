-- ════════════════════════════════════════════════════════════════════
-- PHASE 1 RLS LOCKDOWN — close the world-writable holes on PII +
-- auth config tables.
--
-- Before this migration, four tables had policies named
-- "Users write own profile" / "Admin write X" that used
-- `USING (true)`. That clause means "any caller passes" — and since
-- the anon key is embedded in every client bundle (NEXT_PUBLIC_...),
-- every visitor to the site had the ability to:
--
--   SELECT * FROM customer_profiles      -- read everyone's PII
--   UPDATE customer_profiles SET ...     -- overwrite anyone's row
--   UPDATE registration_config SET ...   -- inject malicious form fields
--   UPDATE auth_providers_config SET ... -- toggle OAuth providers
--   * identity_verification_config       -- read/write API keys
--
-- After this migration:
--   customer_profiles             owner-only RW (auth.uid() = id) + admin read
--   registration_config           public read + admin write
--   auth_providers_config         public read + admin write
--   identity_verification_config  admin-only RW (rows hold provider API keys)
--
-- IMPORTANT — coordinated code change:
-- The existing admin pages call Supabase via the plain anon client
-- (no session cookie attached) and would start getting 401s once these
-- policies bite. This PR also switches the two affected pages
-- (admin/registration, MyPage) to `getSupabaseBrowser()` so the
-- signed-in user's JWT rides along with each request, satisfying the
-- new is_admin() / auth.uid() checks.
-- ════════════════════════════════════════════════════════════════════

-- ── Helper: stable admin check. SECURITY DEFINER lets the function
--    read public.users.role even when the caller's own RLS would hide
--    it (which it now does, for non-admins).
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
      AND role = 'admin'
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated;


-- ─── customer_profiles ──────────────────────────────────────────────
-- Owner-only read/write + admin read. Admin write deliberately not
-- granted: support staff should never quietly mutate a customer record
-- without an audit trail; route that through a dedicated server action
-- with logging if/when it's needed.
DROP POLICY IF EXISTS "Users read own profile"   ON public.customer_profiles;
DROP POLICY IF EXISTS "Users write own profile"  ON public.customer_profiles;
DROP POLICY IF EXISTS "Admin read all profiles"  ON public.customer_profiles;

CREATE POLICY customer_profiles_self_read
  ON public.customer_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY customer_profiles_self_insert
  ON public.customer_profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY customer_profiles_self_update
  ON public.customer_profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY customer_profiles_self_delete
  ON public.customer_profiles FOR DELETE
  USING (auth.uid() = id);

CREATE POLICY customer_profiles_admin_read
  ON public.customer_profiles FOR SELECT
  USING (public.is_admin());


-- ─── registration_config ────────────────────────────────────────────
-- The /register form has to read this anonymously (it controls which
-- fields render in the signup UI), so public read stays. Writes are
-- admin-only.
DROP POLICY IF EXISTS "Public read registration_config"  ON public.registration_config;
DROP POLICY IF EXISTS "Admin write registration_config"  ON public.registration_config;

CREATE POLICY registration_config_public_read
  ON public.registration_config FOR SELECT
  USING (true);

CREATE POLICY registration_config_admin_insert
  ON public.registration_config FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY registration_config_admin_update
  ON public.registration_config FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY registration_config_admin_delete
  ON public.registration_config FOR DELETE
  USING (public.is_admin());


-- ─── auth_providers_config ──────────────────────────────────────────
-- /register reads this anonymously to know which OAuth buttons to
-- render. Admin needs full RW for the integrations page.
DROP POLICY IF EXISTS "Public read auth_providers"   ON public.auth_providers_config;
DROP POLICY IF EXISTS "Admin write auth_providers"   ON public.auth_providers_config;

CREATE POLICY auth_providers_config_public_read
  ON public.auth_providers_config FOR SELECT
  USING (true);

CREATE POLICY auth_providers_config_admin_insert
  ON public.auth_providers_config FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY auth_providers_config_admin_update
  ON public.auth_providers_config FOR UPDATE
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE POLICY auth_providers_config_admin_delete
  ON public.auth_providers_config FOR DELETE
  USING (public.is_admin());


-- ─── identity_verification_config ───────────────────────────────────
-- Rows contain provider API keys (NICE, KCB, etc.). Admin-only for
-- everything; the public signup flow does not read this table.
DROP POLICY IF EXISTS "Public read verification_config" ON public.identity_verification_config;
DROP POLICY IF EXISTS "Admin write verification_config" ON public.identity_verification_config;

CREATE POLICY identity_verification_config_admin_all
  ON public.identity_verification_config FOR ALL
  USING (public.is_admin())
  WITH CHECK (public.is_admin());
