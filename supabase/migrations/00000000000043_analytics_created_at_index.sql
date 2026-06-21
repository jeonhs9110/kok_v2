-- 00000000000043_analytics_created_at_index.sql
-- Adds a btree index on analytics(created_at desc) so the dashboard's
-- "last 7 days / previous 7 days" window queries stop doing full-table
-- scans as the analytics table grows.
--
-- The dashboard fires three concurrent queries per refresh:
--   .gte('created_at', start7d)
--   .gte('created_at', start14d).lt('created_at', start7d)
--   .select('country, path, referrer, created_at, ip_hash')  -- full scan
--
-- The third one still scans (it has no WHERE), but the two windowed
-- queries each go from O(N) to O(log N + window size). At ~1000 visits
-- this is invisible; at ~100K it's the difference between sub-second
-- and multi-second dashboard load.
--
-- Partial-index on `created_at IS NOT NULL` would be slightly smaller
-- but the column is NOT NULL by default for an INSERT-only table, so
-- a plain btree captures every row at no extra cost.

create index if not exists analytics_created_at_idx
  on public.analytics (created_at desc);
