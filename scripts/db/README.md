# Supabase → RDS Migration Runbook

Phase A2 (schema + data dump/restore) + A3 (verification) tooling.

## Pre-requisites

1. **RDS provisioned** — `terraform -chdir=./infrastructure apply` after PR #235 lands.
2. **`pg_dump` / `psql` v16+** on the machine running the migration. macOS: `brew install postgresql@16`. Linux: distro postgresql-client-16 package.
3. **Two connection strings** as env vars:

   ```bash
   export SUPABASE_DB_URL='postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:5432/postgres'
   export RDS_DB_URL='postgresql://kokkok:<password>@<rds-endpoint>:5432/kokkok?sslmode=require'
   ```

   - **Supabase URL**: Dashboard → Project Settings → Database → Connection string → "URI" tab. Use the **Session pooler** string (port 5432) for `pg_dump` compatibility.
   - **RDS URL**: from terraform output `rds_connection_string_template` + password from Secrets Manager:
     ```bash
     aws secretsmanager get-secret-value --secret-id $(terraform -chdir=./infrastructure output -raw rds_secret_arn) --query SecretString --output text | jq -r '.password'
     ```

## Step-by-step

```bash
# 1. Dry-run schema dump — sanity check before touching RDS
./scripts/db/01-dump-schema.sh > /tmp/supabase-schema.sql
wc -l /tmp/supabase-schema.sql           # expect ~3000-5000 lines

# 2. Transform the dump: strip Supabase-specific bits
./scripts/db/02-transform-schema.sh < /tmp/supabase-schema.sql > /tmp/rds-schema.sql

# 3. Restore schema to RDS
./scripts/db/03-restore-schema.sh < /tmp/rds-schema.sql

# 4. Dump + restore data in one pipe (no transform needed for data)
./scripts/db/04-migrate-data.sh

# 5. Verify row counts match between Supabase and RDS
./scripts/db/05-verify.sh
```

## What gets stripped during transformation

The Supabase schema dump includes things RDS doesn't have and we don't want:

| Stripped | Why |
|---|---|
| `CREATE SCHEMA auth` and everything in it | Cognito replaces Supabase Auth |
| `CREATE SCHEMA storage` and everything in it | S3 replaces Supabase Storage |
| `auth.uid()`, `auth.role()`, `auth.jwt()` references | Don't exist on RDS; app-layer auth replaces |
| All `CREATE POLICY ...` statements (RLS) | RLS dropped entirely — all DB access goes through trusted EC2 backend |
| All `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` | Same reason |
| `GRANT` statements to `anon`, `authenticated`, `service_role` | Supabase-internal roles, irrelevant on RDS |
| Supabase extension installs (`pg_graphql`, `pgsodium`, etc.) | Not used by our app |

Kept as-is:

- `public.*` tables — all 27 of them
- Primary keys, foreign keys, indexes
- Functions defined by our migrations (`is_admin()` → will be removed in Phase C as it relies on `auth.uid()`)
- Triggers
- `uuid-ossp`, `pgcrypto` extensions (still useful)

## Rollback

If anything goes wrong mid-migration:

1. **Schema-only failure** (script #03 errors): RDS is empty; safe to drop and retry. `psql $RDS_DB_URL -c 'DROP SCHEMA public CASCADE; CREATE SCHEMA public;'`
2. **Data migration failure** (script #04 errors): same as above; restart from #03.
3. **Verify mismatch** (script #05): root-cause the specific table, fix transform script if needed, re-run.

Throughout all of this, **Supabase is untouched** — the source of truth remains live and serving the storefront. We don't cut over until Phase F.

## After this phase

PR #235 (RDS terraform) + this PR (migration scripts) covers infrastructure + data movement. The app still talks to Supabase. Phase C (app code refactor) is what actually switches the data path.
