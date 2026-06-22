#!/usr/bin/env bash
# Compare row counts between Supabase and RDS for every table in
# public.*. Exits non-zero if any table mismatches — caller can wire
# this into CI / pre-cutover checklist.
#
# Usage:
#   SUPABASE_DB_URL=... RDS_DB_URL=... ./05-verify.sh
set -euo pipefail

if [[ -z "${SUPABASE_DB_URL:-}" || -z "${RDS_DB_URL:-}" ]]; then
  echo "ERROR: SUPABASE_DB_URL and RDS_DB_URL must both be set." >&2
  exit 1
fi

# Pull the table list from RDS (we trust the post-restore schema to be
# complete — if it's missing tables, the schema restore itself would
# have failed). Iterating per-table keeps the SQL portable and the
# diff easy to read.
tables=$(psql "$RDS_DB_URL" -At -c "
  SELECT tablename
    FROM pg_tables
   WHERE schemaname = 'public'
   ORDER BY tablename
")

mismatches=0
printf "%-32s %10s %10s\n" "TABLE" "SUPABASE" "RDS"
printf "%-32s %10s %10s\n" "-----" "--------" "---"

for t in $tables; do
  s=$(psql "$SUPABASE_DB_URL" -At -c "SELECT count(*) FROM public.\"$t\"" 2>/dev/null || echo "?")
  r=$(psql "$RDS_DB_URL"      -At -c "SELECT count(*) FROM public.\"$t\"" 2>/dev/null || echo "?")
  marker=""
  if [[ "$s" != "$r" ]]; then
    marker="  ← MISMATCH"
    mismatches=$((mismatches + 1))
  fi
  printf "%-32s %10s %10s%s\n" "$t" "$s" "$r" "$marker"
done

echo
if [[ $mismatches -gt 0 ]]; then
  echo "[verify] $mismatches mismatched tables. Investigate before Phase F cutover." >&2
  exit 1
fi
echo "[verify] all tables match. Ready for Phase C app refactor."
