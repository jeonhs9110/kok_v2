#!/usr/bin/env bash
# Transform a Supabase schema dump into something RDS can restore.
#
# Strips:
#   - All CREATE POLICY statements (RLS — replaced by app-layer auth)
#   - All ALTER TABLE ... ENABLE/DISABLE ROW LEVEL SECURITY
#   - GRANTs to Supabase-internal roles (anon, authenticated, service_role)
#   - References to auth.uid() / auth.role() / auth.jwt() that would
#     fail to resolve on RDS (functions don't exist there)
#   - Functions that depend on auth.* schema (notably is_admin())
#   - Extension installs Supabase ships that we don't use
#
# Keeps:
#   - All public.* tables + indexes + constraints + sequences
#   - uuid-ossp + pgcrypto extension installs
#
# Reads dump from stdin, writes transformed SQL to stdout.
#
# Usage:
#   ./02-transform-schema.sh < /tmp/supabase-schema.sql > /tmp/rds-schema.sql
set -euo pipefail

# sed with multi-line block matching is hard; use awk to skip whole
# statement blocks delimited by `;`-on-its-own / end-of-statement.
awk '
  # Track whether we are inside a multi-line statement we want to skip
  BEGIN { skip = 0 }

  # Begin-skip patterns. Match the FIRST line of a statement; the
  # close-on-semicolon at the bottom handles end-of-statement detection.
  /^CREATE POLICY /                                  { skip = 1; next }
  /^ALTER TABLE .* ENABLE ROW LEVEL SECURITY/        { skip = 1; next }
  /^ALTER TABLE .* DISABLE ROW LEVEL SECURITY/       { skip = 1; next }
  /^ALTER TABLE .* FORCE ROW LEVEL SECURITY/         { skip = 1; next }
  /^GRANT .* TO "?anon"?/                            { skip = 1; next }
  /^GRANT .* TO "?authenticated"?/                   { skip = 1; next }
  /^GRANT .* TO "?service_role"?/                    { skip = 1; next }
  /^REVOKE .* FROM "?anon"?/                         { skip = 1; next }
  /^REVOKE .* FROM "?authenticated"?/                { skip = 1; next }
  /^REVOKE .* FROM "?service_role"?/                 { skip = 1; next }

  # Supabase-internal extensions we do not need on RDS. Our app uses
  # uuid-ossp + pgcrypto only — those pass through.
  /^CREATE EXTENSION .*"?pg_graphql"?/               { skip = 1; next }
  /^CREATE EXTENSION .*"?pgsodium"?/                 { skip = 1; next }
  /^CREATE EXTENSION .*"?pgjwt"?/                    { skip = 1; next }
  /^CREATE EXTENSION .*"?supabase_vault"?/           { skip = 1; next }

  # Functions that reference auth.uid() will not resolve on RDS.
  # The big one is is_admin() — its body queries public.users where
  # id = auth.uid(). Dropping the function altogether: app-layer
  # admin checks replace this entirely (middleware reads Cognito
  # group membership from the JWT).
  /^CREATE (OR REPLACE )?FUNCTION .*is_admin/        { skip = 1; next }

  # Close-on-semicolon: when we are skipping and hit a line ending in
  # `;` (possibly with trailing whitespace), exit skip mode.
  skip == 1 && /;[[:space:]]*$/                       { skip = 0; next }
  skip == 1                                           { next }

  # Default: pass through.
  { print }
' | \
# Final sweep — drop any stray inline references to auth.* in WHERE
# clauses (e.g. CHECK constraints that survived the policy strip).
# These would error out on RDS at restore time.
sed -E '
  /auth\.uid\(\)/d
  /auth\.role\(\)/d
  /auth\.jwt\(\)/d
'
