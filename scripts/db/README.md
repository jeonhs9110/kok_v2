# Supabase → RDS Migration Runbook

**⚠️ HISTORICAL — migration completed 2026-06-25.** This tooling captured + restored the production data from Supabase to RDS. Retained as reference for the migration sequence; the scripts themselves are no longer executed.

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

One-shot wrapper (recommended):
```bash
SUPABASE_DB_URL=... RDS_DB_URL=... ./scripts/db/00-migrate-all.sh
```

Or run the steps individually if you want to inspect intermediate output:
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

The whole thing runs in <30s at our scale (~4000 rows total).

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

---

## Cutover (Phase F)

Run this AFTER all of these have merged: #239 (C1c reads), #240 (C2a server writes),
#244 (C2b products), #241 (D Cognito), #242 (E S3), plus the C2b expansion +
D2 sign-in + E2 storage move PRs.

### Pre-cutover checklist

- [ ] **Data migrated.** `00-migrate-all.sh` finished green within the last 24h. The window matters — Supabase will keep accepting writes until the flag flip, and anything written there after the migration is lost unless you re-run.
- [ ] **Storage migrated.** Every object under the Supabase Storage buckets (`product-images`, `carousel`, `assets`, etc.) is mirrored into `s3://kokkok-storage-<suffix>/`. Inventory diff is empty.
- [ ] **CloudFront in front of S3** — `S3_PUBLIC_CDN_URL` set on EC2 and resolves. Without this every storefront `<Image>` would 403 from the bucket's public-access block.
- [ ] **Cognito admin user(s) provisioned.** At minimum, every operator with `users.role = 'admin'` in Supabase has been added to Cognito's `admins` group. Test: a fresh login from each → land on `/admin/...` without redirect to `/`.
- [ ] **EC2 env vars staged but not yet applied.** Set `USE_RDS=true`, `USE_COGNITO=true`, `USE_S3=true`, `NEXT_PUBLIC_USE_RDS=true`, `S3_STORAGE_BUCKET`, `S3_PUBLIC_CDN_URL`, `COGNITO_USER_POOL_ID`, `COGNITO_CLIENT_ID`, `DATABASE_URL` (in the secret store the EC2 process reads from).
- [ ] **Smoke-test artifact built** against the new env vars — the build-publish-artifact workflow's last green run with `NEXT_PUBLIC_USE_RDS=true` set in repo secrets.

### Cutover steps

1. Last-minute delta sync: `./scripts/db/04-migrate-data.sh` once more so anything written to Supabase in the last hour reaches RDS. If `05-verify.sh` mismatches, halt and investigate before flipping.
2. Set storefront under maintenance (optional but recommended for the 5-minute window): a single `<MaintenanceBanner/>` toggled by a `MAINTENANCE_MODE=true` env var, or a CloudFront error-page override. We expect zero downtime but a banner reduces support tickets if something does go sideways.
3. `terraform -chdir=./infrastructure apply -replace=aws_instance.app` — picks up the new env vars and the new build artifact in one go.
4. Wait for ALB target to flip to healthy (~90s on warm cache).
5. Smoke-test from a fresh incognito session: load `/kr` (storefront), `/admin` (login flow goes through Cognito), create a test product → save → confirm it appears on the storefront after a page refresh.
6. Drop the maintenance banner if you raised one.
7. Leave Supabase running, untouched, for 14 days as the rollback escape valve. After 14 days with no issues: deprovision the project + cancel the $20/mo subscription.

### Rollback

If anything looks wrong before step 7's 14-day window expires:

```bash
# Flip the env back. Same terraform replace cycle.
USE_RDS=false USE_COGNITO=false USE_S3=false NEXT_PUBLIC_USE_RDS=false \
  terraform -chdir=./infrastructure apply -replace=aws_instance.app
```

Two caveats:
- **Admin writes made AFTER cutover live on RDS only.** Rolling back means those writes vanish from the operator's perspective. Communicate this explicitly to the operator before the cutover — once they save through the new path, "rollback" isn't free.
- **Storage objects uploaded AFTER cutover live in S3 only.** Rolling back means the storefront serves Supabase Storage URLs which won't include those new images. Re-mirror S3 → Supabase before the rollback if any new admin upload happened.

### What still talks to Supabase post-cutover

Nothing in the storefront or admin code paths. The only reason Supabase stays alive is:
- The legacy `users.role` table reads from `requireAdmin()`'s Supabase fallback path — only reachable if `USE_COGNITO=false`, so post-cutover it's dead code.
- Historical reference: keeping the old data accessible while we trust RDS for ~2 weeks.
