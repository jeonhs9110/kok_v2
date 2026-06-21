-- 00000000000040_product_seo.sql
-- Adds a SEO settings JSONB column to products so each product can
-- carry its own browser title, meta description, keywords, image alt
-- text, and a search-engine visibility flag — Cafe24's "SEO 설정" tab
-- for every product, brought to KOKKOK GARDEN.
--
-- Shape:
--   {
--     "indexable": boolean,    // false => noindex,follow
--     "title": string|null,    // browser title; overrides product.name in <title>
--     "author": string|null,   // <meta name="author">
--     "description": string|null, // <meta name="description"> + OG description
--     "keywords": string|null, // <meta name="keywords"> (comma-separated)
--     "imageAlt": string|null  // <img alt> on the main product image
--   }
--
-- NULL is the default; storefront generateMetadata falls back to the
-- previous behavior (product.name / product.summary) when fields are
-- empty so unmigrated rows render identically.

alter table public.products
  add column if not exists seo jsonb;

comment on column public.products.seo is
  'Per-product SEO settings: title / description / keywords / imageAlt / indexable. Read by /[lang]/products/[id] generateMetadata.';
