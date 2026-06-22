#!/usr/bin/env bash
# Schema-only dump from Supabase. Captures table definitions, indexes,
# constraints, sequences — NO data. Pipe to stdout so caller can
# inspect / transform before restoring.
#
# Usage:
#   SUPABASE_DB_URL=postgresql://... ./01-dump-schema.sh > /tmp/supabase-schema.sql
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL not set. See scripts/db/README.md." >&2
  exit 1
fi

# --schema=public           only our app's schema (not auth / storage)
# --schema-only             definitions, no data
# --no-owner / --no-privileges  skip Supabase-internal roles
# --no-comments             reduce noise; comments rarely matter at restore
# --exclude-table-data='*'  belt-and-suspenders for --schema-only
pg_dump \
  "$SUPABASE_DB_URL" \
  --schema=public \
  --schema-only \
  --no-owner \
  --no-privileges \
  --no-comments \
  --quote-all-identifiers
