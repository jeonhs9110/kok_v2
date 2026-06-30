-- 2026-06-30 — capture pre-migration schema that drifted from repo
--
-- Three tables in prod RDS have columns that no migration file ever
-- created — they were added directly to Supabase Postgres before the
-- migration discipline kicked in, ported over during the 2026-06-25
-- RDS cutover, and only documented in src/lib/db/types.ts. That makes
-- the migration history non-replayable: a fresh RDS provisioned from
-- supabase/migrations/*.sql alone would be missing columns the code
-- writes to and would silently fail on first admin save.
--
-- This migration captures the actual prod shape so the next team can
-- rebuild a clean RDS from migrations end-to-end. Every statement is
-- IF NOT EXISTS so re-running against the live DB is a no-op.
--
-- All shapes were inspected from prod RDS on 2026-06-30:
--   * categories: id, parent_id, slug, name(jsonb), sort_order,
--       is_active, created_at
--   * products: + category_id, subcategory_id  (both FK to categories
--       ON DELETE SET NULL, matching prod constraint names)
--   * shorts: + product_id (uuid), title (text)

-- ─── 1. categories ──────────────────────────────────────────────────
-- Self-referential parent_id supports the 2-level menu nav (category →
-- subcategory). FK to categories.id is declared inline so a fresh
-- create has the constraint immediately, not as a follow-up migration.

CREATE TABLE IF NOT EXISTS public.categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  slug text NOT NULL,
  name jsonb NOT NULL DEFAULT '{}'::jsonb,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone DEFAULT now()
);

-- ─── 2. products.category_id + subcategory_id ──────────────────────
-- Matches prod constraint names so DROP CONSTRAINT in any future
-- migration uses the same identifier the DBA would see in psql \d.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS category_id uuid;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS subcategory_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'products_category_id_fkey'
       AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_category_id_fkey
      FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'products_subcategory_id_fkey'
       AND conrelid = 'public.products'::regclass
  ) THEN
    ALTER TABLE public.products
      ADD CONSTRAINT products_subcategory_id_fkey
      FOREIGN KEY (subcategory_id) REFERENCES public.categories(id) ON DELETE SET NULL;
  END IF;
END
$$;

-- ─── 3. shorts.product_id + title ──────────────────────────────────
-- product_id links a YouTube short to a single product so the
-- storefront can render "as seen in this short" CTAs. No FK in prod
-- (the column was added before the products table had stable IDs);
-- leaving it null-able + un-constrained matches prod exactly.

ALTER TABLE public.shorts
  ADD COLUMN IF NOT EXISTS product_id uuid;
ALTER TABLE public.shorts
  ADD COLUMN IF NOT EXISTS title text;
