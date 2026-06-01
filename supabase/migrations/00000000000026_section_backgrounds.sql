-- ════════════════════════════════════════════════════════════════════
-- SECTION BACKGROUNDS (Shorts + Instagram)
--
-- Lets the admin pick a background per homepage section: transparent,
-- a solid color, an image, or a video. Until today both sections were
-- hardcoded (ShortsFeed: bg-neutral-900 / Instagram: inherits page bg)
-- — this surfaces those choices to /admin/shorts and /admin/instagram.
--
-- One column set, applied to two tables:
--   * instagram_config — already exists, already a singleton row; we
--     just bolt the bg columns on.
--   * shorts_config — new singleton table; shorts has its own item
--     table but no config row until now, so we create one and seed it.
--
-- Storefront fallback when bg_type is null:
--   ShortsFeed       → bg-neutral-900 (legacy black)
--   InstagramSection → transparent    (legacy: inherits page bg)
-- ════════════════════════════════════════════════════════════════════

ALTER TABLE public.instagram_config
  -- 'transparent' | 'color' | 'image' | 'video'. Free text on purpose:
  -- the renderer treats anything it doesn't recognize as 'transparent'.
  ADD COLUMN IF NOT EXISTS bg_type       text,
  ADD COLUMN IF NOT EXISTS bg_color      text,
  ADD COLUMN IF NOT EXISTS bg_media_url  text,
  -- 'image' | 'video' — derived at upload time, persisted so the
  -- renderer doesn't have to sniff the URL.
  ADD COLUMN IF NOT EXISTS bg_media_type text;


-- shorts_config — singleton row mirroring instagram_config's shape so
-- the shared SectionBackgroundPanel can drive both with the same code.
CREATE TABLE IF NOT EXISTS public.shorts_config (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bg_type       text,
  bg_color      text,
  bg_media_url  text,
  bg_media_type text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

-- Seed the singleton row so the admin page can UPDATE without an
-- INSERT branch. The pattern mirrors how instagram_config was seeded.
INSERT INTO public.shorts_config (id, bg_type)
SELECT gen_random_uuid(), null
WHERE NOT EXISTS (SELECT 1 FROM public.shorts_config);

-- RLS: same Pattern A as the rest of the storefront config tables —
-- public can read, only authenticated admins can write. See migration
-- 18 for the helper rationale.
ALTER TABLE public.shorts_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS shorts_config_public_read   ON public.shorts_config;
DROP POLICY IF EXISTS shorts_config_admin_insert  ON public.shorts_config;
DROP POLICY IF EXISTS shorts_config_admin_update  ON public.shorts_config;
DROP POLICY IF EXISTS shorts_config_admin_delete  ON public.shorts_config;

CREATE POLICY shorts_config_public_read
  ON public.shorts_config FOR SELECT
  USING (true);

CREATE POLICY shorts_config_admin_insert
  ON public.shorts_config FOR INSERT
  WITH CHECK (public.is_admin());

CREATE POLICY shorts_config_admin_update
  ON public.shorts_config FOR UPDATE
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE POLICY shorts_config_admin_delete
  ON public.shorts_config FOR DELETE
  USING (public.is_admin());
