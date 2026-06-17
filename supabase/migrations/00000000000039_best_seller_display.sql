-- Best seller display config — operator-controlled overall scale + gaps
-- for the homepage "BEST SELLER" product grid. Operator's 2026-06-17 ask
-- after pointing at the grid: "make this part bigger and let me adjust
-- the spacing between products from the homepage builder."
--
-- Singleton site_settings row. Schema:
--   { card_scale: 1.0, gap_x: 16, gap_y: 48 }
-- card_scale (0.6–1.4) multiplies the ProductCard width within the grid
-- so the whole row grows or shrinks uniformly. gap_x / gap_y are pixel
-- gaps between cards (horizontal / vertical).

INSERT INTO public.site_settings (key, value)
VALUES (
  'best_seller_display',
  '{"card_scale":1.0,"gap_x":16,"gap_y":48}'
)
ON CONFLICT (key) DO NOTHING;
