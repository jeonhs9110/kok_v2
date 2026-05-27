-- Library of background media (images or videos) the admin can manage from
-- /admin/logo (now '로고 및 배경 관리'). At most one row at a time is active —
-- enforced in the admin client when toggling, not via DB constraint, so the
-- table behaviour matches `carousel_slides` / `sub_hero_banners` (just rows
-- the admin can flip).

CREATE TABLE IF NOT EXISTS public.site_backgrounds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_url    text NOT NULL,
  file_name   text DEFAULT '',
  file_type   text NOT NULL DEFAULT 'image', -- 'image' | 'video'
  mime_type   text DEFAULT '',
  sort_order  integer DEFAULT 0,
  is_active   boolean DEFAULT false,
  created_at  timestamptz DEFAULT timezone('utc', now())
);

ALTER TABLE public.site_backgrounds ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read site_backgrounds"  ON public.site_backgrounds;
DROP POLICY IF EXISTS "Public write site_backgrounds" ON public.site_backgrounds;
CREATE POLICY "Public read site_backgrounds"  ON public.site_backgrounds FOR SELECT USING (true);
CREATE POLICY "Public write site_backgrounds" ON public.site_backgrounds FOR ALL    USING (true);

-- Partial index so "find the active one" is O(1) (only ever one row matches).
CREATE INDEX IF NOT EXISTS idx_site_backgrounds_active
  ON public.site_backgrounds (is_active)
  WHERE is_active = true;
