#!/usr/bin/env bash
# Stream data from Supabase to RDS in a single pg_dump | psql pipe.
#
# Data-only dump (--data-only) since schema is already restored by 03.
# --disable-triggers prevents foreign-key enforcement during the load,
# which means we don't have to figure out the dependency order ourselves.
# Triggers re-enable automatically at the end.
#
# At our scale (~4000 rows total) the whole thing runs in <30s.
#
# Usage:
#   SUPABASE_DB_URL=... RDS_DB_URL=... ./04-migrate-data.sh
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" || -z "${RDS_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL and RDS_DB_URL must both be set." >&2
  exit 1
fi

echo "[migrate-data] streaming public.* data Supabase → RDS …" >&2

pg_dump \
  "$SUPABASE_DB_URL" \
  --schema=public \
  --data-only \
  --disable-triggers \
  --no-owner \
  --no-privileges \
  --quote-all-identifiers \
| \
psql \
  "$RDS_DB_URL" \
  --set ON_ERROR_STOP=on \
  --quiet \
  --single-transaction

echo "[migrate-data] done." >&2
