-- Phase D2 of the analytics-detail rebuild (2026-06-24, CEO follow-up).
--
-- Per-visit columns:
--   device_type    : 'mobile' | 'tablet' | 'desktop'. Parsed from the
--                    User-Agent in /api/track at write time. ~80% of
--                    Korean e-commerce is mobile; the CEO can't even
--                    ask "is the new mobile carousel working?" without
--                    knowing the device split.
--   utm_source     : campaign source from the landing URL's ?utm_source.
--   utm_medium     : campaign medium (cpc, social, email, …).
--   utm_campaign   : specific campaign tag.
--                    These three let the CEO measure paid Naver/Google
--                    ad clicks separately from organic referrals — same
--                    referrer host, completely different conversion
--                    expectations. Without this, ad spend ROAS is
--                    impossible to compute.
--
-- All four columns are nullable. Legacy rows (pre-this-migration)
-- get NULL; the dashboard treats NULL as 'unknown' / 'organic' in the
-- respective panels. No backfill.

alter table public.analytics
  add column if not exists device_type text,
  add column if not exists utm_source text,
  add column if not exists utm_medium text,
  add column if not exists utm_campaign text;

create index if not exists analytics_device_created_idx
  on public.analytics (device_type, created_at desc)
  where device_type is not null;

create index if not exists analytics_utm_source_idx
  on public.analytics (utm_source, created_at desc)
  where utm_source is not null;

create index if not exists analytics_utm_campaign_idx
  on public.analytics (utm_campaign, created_at desc)
  where utm_campaign is not null;

comment on column public.analytics.device_type is
  'mobile | tablet | desktop, parsed from the User-Agent header at write time.';
comment on column public.analytics.utm_source is
  'utm_source query param from the landing URL — paid campaign source tag.';
comment on column public.analytics.utm_medium is
  'utm_medium query param — paid campaign medium (cpc, social, email).';
comment on column public.analytics.utm_campaign is
  'utm_campaign query param — specific campaign identifier.';
