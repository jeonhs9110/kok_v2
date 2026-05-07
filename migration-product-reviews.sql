-- User-submitted product reviews, separated from board comments and the
-- admin-curated review_cards showcase. Surfaced on /[lang]/products/[id].

CREATE TABLE IF NOT EXISTS public.product_reviews (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  author_name text NOT NULL,
  rating integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title text,
  content text NOT NULL,
  is_published boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_product_reviews_product
  ON public.product_reviews(product_id, created_at DESC);

ALTER TABLE public.product_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read published reviews.
DROP POLICY IF EXISTS product_reviews_select ON public.product_reviews;
CREATE POLICY product_reviews_select ON public.product_reviews
  FOR SELECT USING (is_published = true);

-- Anyone can submit a review (anon writes — admin can hide via is_published).
DROP POLICY IF EXISTS product_reviews_insert ON public.product_reviews;
CREATE POLICY product_reviews_insert ON public.product_reviews
  FOR INSERT WITH CHECK (true);
