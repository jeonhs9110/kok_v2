-- Adds opt-in flag for scroll-scrubbed video playback (Apple-style scroll
-- timeline). When true, SiteBackground binds video.currentTime to the page
-- scroll position instead of autoplaying on loop. Per-row so a site can
-- have multiple backgrounds in the library with different behaviors.

ALTER TABLE public.site_backgrounds
  ADD COLUMN IF NOT EXISTS scroll_driven boolean DEFAULT false;
