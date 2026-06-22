#!/usr/bin/env bash
# Restore the transformed schema to RDS. Reads SQL from stdin.
#
# Fails fast on any error (psql --set ON_ERROR_STOP=on). Better to
# halt and inspect than to leave RDS in a half-restored state.
#
# Usage:
#   ./03-restore-schema.sh < /tmp/rds-schema.sql
set -euo pipefail

if [[ -z "${RDS_DB_URL:-}" ]]; then
  echo "ERROR: RDS_DB_URL not set. See scripts/db/README.md." >&2
  exit 1
fi

# --set ON_ERROR_STOP=on   abort at the first error
# --quiet                  suppress noisy "CREATE TABLE" / "NOTICE" output
# --single-transaction     wrap the whole restore in a TX — atomic
#                          all-or-nothing. If anything fails, RDS rolls
#                          back to empty rather than leaving partial state.
psql \
  "$RDS_DB_URL" \
  --set ON_ERROR_STOP=on \
  --quiet \
  --single-transaction
