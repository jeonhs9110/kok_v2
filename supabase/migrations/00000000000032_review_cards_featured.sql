-- One "featured" review card surfaces inline at /[lang]/menus/review
-- instead of the grid. Customer click on Review & Community in the
-- nav lands directly on the featured post's body content (no
-- thumbnail click step). 송이 wanted the curated review the brand is
-- pushing this week to be the first thing customers see.
--
-- Only one row should be featured at a time; the admin write-side
-- handler in src/app/admin/reviews/page.tsx flips the flag off on
-- every other row when one is turned on. No DB-level constraint
-- because Supabase Studio can edit rows bypassing the admin handler
-- — the storefront query picks the first match if multiple are
-- flagged, so misalignment is bounded.

ALTER TABLE public.review_cards
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS review_cards_featured_idx
  ON public.review_cards (is_featured)
  WHERE is_featured = true;

COMMENT ON COLUMN public.review_cards.is_featured IS
  'When true, this card surfaces inline at /menus/review instead of the grid. Only one row should be true at a time — enforced in the admin write handler.';
