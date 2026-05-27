-- ============================================================
-- KOKKOK GARDEN V2 — Product detail-body column
-- Adds a rich HTML "detail body" for product detail pages.
-- Boss can author long-form copy + inline images here.
-- Run this in Supabase → SQL Editor
-- ============================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS detail_body text DEFAULT '';

-- detail_body is plain HTML produced by Tiptap on the admin side.
-- No schema change needed for RLS — existing public-read policies on
-- products already cover this new column.
