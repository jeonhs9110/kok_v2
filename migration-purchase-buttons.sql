-- Phase 1 (#10): Per-product purchase-button visibility toggles
-- Default: hidden. Only Naver store button shown unless admin opts in.

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS show_cart_button boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS show_buy_button  boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.products.show_cart_button IS
  'If true, display the 장바구니 button on product detail. Default false.';
COMMENT ON COLUMN public.products.show_buy_button IS
  'If true, display the 구매하기 button on product detail. Default false.';
