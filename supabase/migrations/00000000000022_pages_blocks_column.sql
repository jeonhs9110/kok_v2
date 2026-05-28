-- Add the `blocks` JSONB column that backs the new page builder.
--
-- Shape (per src/lib/pages/blocks.ts):
--   {
--     "kr": PageBlock[],
--     "en": PageBlock[]
--   }
--
-- The existing `content` column (legacy plain rich-text JSON) is kept
-- as a fallback so old pages still render until they're migrated to
-- blocks. The public renderer prefers `blocks` when present.

ALTER TABLE public.pages
  ADD COLUMN IF NOT EXISTS blocks JSONB;

COMMENT ON COLUMN public.pages.blocks IS
  'Per-language page-builder block list. Shape: { [lang]: PageBlock[] }. See src/lib/pages/blocks.ts. Falls back to .content when null.';
