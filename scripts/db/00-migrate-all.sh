#!/usr/bin/env bash
# One-shot wrapper around the 01–05 migration pipeline.
#
# Streams a Supabase → RDS migration end to end:
#   01. dump schema  →  02. transform  →  03. restore schema
#   04. dump+restore data  →  05. verify row counts
#
# Stops at the first failure. Verification mismatches at step 5 are
# treated as failure too — investigate before flipping USE_RDS.
#
# Usage:
#   SUPABASE_DB_URL=... RDS_DB_URL=... ./scripts/db/00-migrate-all.sh
#
# Optional:
#   KEEP_TMP=1  — keep /tmp/{supabase,rds}-schema.sql for inspection
#                 (default: clean up on success).
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" || -z "${RDS_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL and RDS_DB_URL must both be set." >&2
  exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RAW_SCHEMA=/tmp/supabase-schema.sql
RDS_SCHEMA=/tmp/rds-schema.sql

step() {
  echo
  echo "═══ $1 ═══" >&2
}

step "1/5  dump Supabase schema"
"$SCRIPT_DIR/01-dump-schema.sh" > "$RAW_SCHEMA"
echo "    → $(wc -l < "$RAW_SCHEMA") lines"

step "2/5  transform schema (strip auth.*, RLS, supabase extensions)"
"$SCRIPT_DIR/02-transform-schema.sh" < "$RAW_SCHEMA" > "$RDS_SCHEMA"
echo "    → $(wc -l < "$RDS_SCHEMA") lines"

step "3/5  restore schema to RDS"
"$SCRIPT_DIR/03-restore-schema.sh" < "$RDS_SCHEMA"

step "4/5  stream public.* data Supabase → RDS"
"$SCRIPT_DIR/04-migrate-data.sh"

step "5/5  verify row counts"
"$SCRIPT_DIR/05-verify.sh"

if [[ "${KEEP_TMP:-}" != "1" ]]; then
  rm -f "$RAW_SCHEMA" "$RDS_SCHEMA"
fi

echo
echo "✓ migration complete. RDS is ready for Phase F cutover."
echo "  Next: see scripts/db/README.md → 'Cutover (Phase F)'"
