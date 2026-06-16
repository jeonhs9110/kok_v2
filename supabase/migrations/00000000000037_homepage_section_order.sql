-- Homepage section render order — operator-controlled.
--
-- Previously the [lang]/page.tsx hardcoded the section sequence
-- (carousel → promo-banners → products → shorts → sub-hero → instagram).
-- Operator's 2026-06-17 ask: drag a section card in the builder to
-- reorder it on the storefront.
--
-- Stored as a singleton site_settings row keyed 'homepage_section_order'
-- with a JSON array of section keys. The storefront renders sections
-- in that order; any key NOT in the array falls back to the default
-- order at the END so a newly-added section never disappears.

INSERT INTO public.site_settings (key, value)
VALUES (
  'homepage_section_order',
  '["carousel","promo-banners","products","shorts","sub-hero","instagram"]'
)
ON CONFLICT (key) DO NOTHING;
