-- ─────────────────────────────────────────────────────────────────────
-- One-shot backfill — public.users from public.customer_profiles
--
-- Context
-- =======
-- Pre-Cognito, Supabase's auth.users had a trigger that auto-populated
-- public.users on every sign-up. After the 2026-06-27 Cognito cutover
-- that trigger was gone and the equivalent INSERT in the
-- complete-registration route wasn't added until PR #318 landed
-- on 2026-06-29. So every customer who signed up between those two
-- dates has a customer_profiles row but NO public.users row, which
-- means:
--   - /admin/users doesn't show them
--   - admin role-promotion via /api/admin/users/[id] PATCH no-ops
--     (the UPDATE matches zero rows)
--   - the dashboard's "new members" counter is off
--
-- PR #318 fixes the going-forward path. This script fixes the gap
-- window — drop in the orphaned customer_profiles rows as 'user'
-- with is_verified=true (Cognito's ConfirmSignUp ran for them
-- upstream so the email IS verified, even though we never wrote
-- the flag).
--
-- Idempotent: the LEFT JOIN filter means re-running the script is
-- safe — only rows that don't already exist in public.users get
-- inserted.
--
-- How to run
-- ==========
--   psql "$RDS_DB_URL" -f scripts/db/backfill_users_from_customer_profiles.sql
--
-- Or pipe to grep "INSERT 0 N" to see how many rows landed.
-- ─────────────────────────────────────────────────────────────────────

BEGIN;

-- Dry-run check: how many orphaned customer_profiles rows are there?
-- Logged so the operator sees the magnitude before the INSERT fires.
DO $$
DECLARE
  orphan_count integer;
BEGIN
  SELECT COUNT(*) INTO orphan_count
  FROM public.customer_profiles cp
  LEFT JOIN public.users u ON u.id = cp.id
  WHERE u.id IS NULL;
  RAISE NOTICE 'Found % customer_profiles rows without a matching public.users row.', orphan_count;
END $$;

INSERT INTO public.users (id, email, role, is_verified, created_at)
SELECT
  cp.id,
  cp.email,
  'user',
  true,            -- Cognito ConfirmSignUp ran for them; email IS verified
  cp.created_at    -- preserve original sign-up time so /admin/users sort is honest
FROM public.customer_profiles cp
LEFT JOIN public.users u ON u.id = cp.id
WHERE u.id IS NULL;

-- Post-insert sanity check
DO $$
DECLARE
  remaining integer;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM public.customer_profiles cp
  LEFT JOIN public.users u ON u.id = cp.id
  WHERE u.id IS NULL;
  IF remaining > 0 THEN
    RAISE EXCEPTION 'Backfill incomplete: % rows still missing from public.users', remaining;
  END IF;
  RAISE NOTICE 'Backfill complete — every customer_profiles row now has a public.users entry.';
END $$;

COMMIT;
