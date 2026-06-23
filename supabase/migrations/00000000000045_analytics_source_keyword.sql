-- Phase A of the analytics-detail rebuild (2026-06-24, boss meeting).
--
-- Per-visit columns:
--   traffic_source : pre-categorized bucket (google / naver / daum /
--                    bing / yahoo / duckduckgo / instagram / facebook /
--                    kakao / twitter / direct / other). Computed at
--                    write time inside /api/track from the referrer
--                    URL so the dashboard doesn't have to re-parse
--                    every row.
--   search_keyword : the actual query the visitor typed, parsed from
--                    the referrer URL's q / query / p / k param when
--                    the source is a search engine. Google often
--                    sends "(not provided)" since they encrypted query
--                    strings ~2013 — store whatever they send;
--                    Naver / Daum / Bing / Yahoo / DuckDuckGo all
--                    still pass keywords for non-logged-in visitors.
--
-- Both columns are nullable + indexed: traffic_source so the dashboard
-- can group by source efficiently without a referrer string parse;
-- (traffic_source, search_keyword) so the dashboard can pull the top
-- keywords per source in a single scan.
--
-- No backfill on the historical rows. Legacy rows just have NULL for
-- both columns — the dashboard's categorizeReferrer() still parses the
-- text `referrer` column for those (PR-B will switch to the new
-- columns for fresh rows).

alter table public.analytics
  add column if not exists traffic_source text,
  add column if not exists search_keyword text;

create index if not exists analytics_traffic_source_created_idx
  on public.analytics (traffic_source, created_at desc)
  where traffic_source is not null;

create index if not exists analytics_source_keyword_idx
  on public.analytics (traffic_source, search_keyword)
  where search_keyword is not null;

comment on column public.analytics.traffic_source is
  'Pre-categorized acquisition bucket. One of: google, naver, daum, bing, yahoo, duckduckgo, instagram, facebook, kakao, twitter, direct, other. Computed from the referrer URL at write time.';
comment on column public.analytics.search_keyword is
  'Search query parsed from the referrer URL for search-engine sources. Empty string or "(not provided)" for Google HTTPS visits; usable text for Naver / Daum / Bing / Yahoo / DuckDuckGo.';
