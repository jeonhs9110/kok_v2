-- 00000000000041_analytics_ip_hash.sql
-- Adds an `ip_hash` column to public.analytics so the dashboard can
-- detect repeat visitors without storing PII (raw IPs).
--
-- The /api/track route hashes the client's x-forwarded-for IP with a
-- server-side secret salt (ANALYTICS_IP_SALT env) before writing — so
-- the stored hash is irreversible AND not correlatable across
-- deployments that use a different salt. Two visits from the same IP
-- in the same deployment produce the same hash → enables "재방문자"
-- counts.
--
-- An index on (ip_hash, created_at desc) lets the dashboard ask
-- "how many distinct IPs had > 1 visit in the last 7 days" without a
-- full-table scan even after the analytics table grows large.

alter table public.analytics
  add column if not exists ip_hash text;

create index if not exists analytics_ip_hash_created_idx
  on public.analytics (ip_hash, created_at desc)
  where ip_hash is not null;

comment on column public.analytics.ip_hash is
  'SHA-256 hex digest of the client IP + ANALYTICS_IP_SALT secret. Never store raw IPs.';
