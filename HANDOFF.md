# Handoff to Dynamic Solution

## What this doc is

The 10 things you need to know first. If you're inheriting this codebase, read this before touching anything else. This file is the **technical** onboarding — architecture map, runtime paths, deploy flow, and the handful of things that will save you 3 hours if you know them. Operational context (pending 권대영 IAM asks, admin operator workflow, open handoff action items) is delivered separately outside the repo.

---

## 1. The runtime, in one paragraph

Next.js 16 (App Router) + React 19 + TypeScript 5. Server-side rendered on a single EC2 t4g.small in `ap-northeast-2`, behind ALB → CloudFront → Route 53. Data in RDS Postgres 16 (single-AZ, db.t4g.micro). Auth in Cognito. Media in S3 served through CloudFront at `/media/*`. Transactional email through SES (production access pending). Chatbot uses OpenAI gpt-4o-mini. All infra is Terraform (`infrastructure/*.tf`) except IAM roles (owned by Dynamic Solution's AWS account admin).

## 2. First-run: `npm install` && `npm run dev`

Requirements:
- **Node 22+** (`.nvmrc` = `22`; enforced via `package.json` engines)
- **npm** (comes with Node)
- **AWS credentials** for the `kokkokgarden` profile if you want to run `terraform` or the deploy scripts — the dev server itself only needs env vars.

`.env.local` (copy from `.env.example`):
- The app dispatches on `USE_RDS` / `USE_COGNITO` flags — when a flag is `false` or unset, calls fall back to the (deprecated) Supabase path. **You almost certainly want `USE_RDS=true` and `USE_COGNITO=true`** for anything realistic.
- `DATABASE_URL` points at prod RDS by default. If you don't want that, spin up a local Postgres 16 with `docker run -e POSTGRES_PASSWORD=... postgres:16` and apply `supabase/migrations/*.sql` in numeric order.
- `OPENAI_API_KEY` is only needed if you're testing chat.

## 3. The dispatcher pattern (RDS vs Supabase)

Every data-access file in `src/lib/api/*` follows the same shape:

```ts
export async function getX(): Promise<X> {
  if (process.env.USE_RDS === 'true') {
    const { getXFromPg } = await import('@/lib/db/x-reads');
    return getXFromPg();
  }
  // ...Supabase fallback
}
```

The Supabase branches exist for two reasons:
- Dev machines that don't have RDS access
- The 2-hour cutover window on 2026-06-25 wanted a rollback path

**Post-handoff you can delete every Supabase branch.** The RDS side is the source of truth. See `src/lib/db/` for the pg query implementations.

Client-side there's a mirror: `USE_RDS_FROM_BROWSER` (`NEXT_PUBLIC_USE_RDS`) controls whether `/admin/*` hooks POST to `/api/admin/*` (server-side RDS) or call the Supabase JS client directly. Server and client flags MUST flip together.

## 4. Auth flow

1. Customer signs in via `/api/auth/cognito/sign-in` → Cognito ID token + Refresh token stored in httpOnly cookies (`cognito_id_token`, `cognito_refresh_token`).
2. `src/proxy.ts` middleware verifies the ID token on every `/admin/*` request via `aws-jwt-verify` (JWKS cached).
3. Admin access = presence of `admins` in the JWT's `cognito:groups` claim. Super-admin = `super_admins`.
4. RDS `public.users` row + `public.customer_profiles` row created lazily in `/api/auth/cognito/complete-registration`.
5. Cognito user pool ID + client ID are baked into the client bundle at build time (see `.github/workflows/build-publish-artifact.yml`) — they're not secrets, they identify the pool but need a valid signed JWT to mutate.

## 5. Deploy flow

**Prod deploys go through GitHub Actions:**

1. Merge to `master` → `.github/workflows/build-publish-artifact.yml` runs
2. Builds Next.js standalone bundle on `ubuntu-24.04-arm` (matches t4g.small's Graviton CPU)
3. Uploads `app.tar.gz` to `s3://kokkok-deploy-artifacts/latest.tar.gz`
4. **PR #352 adds** an SSM Run Command step that triggers `/usr/local/bin/kokkok-refresh.sh` on the EC2 instance immediately after — until that merges, deploys are manual (see below).

**Manual refresh (until #352 lands):**

```bash
aws ssm send-command \
  --profile kokkokgarden \
  --instance-ids i-0d56867ef412ab182 \
  --document-name AWS-RunShellScript \
  --parameters 'commands=["sudo /usr/local/bin/kokkok-refresh.sh"]'
```

The refresh script (checked into `infrastructure/scripts/kokkok-refresh.sh`):
- Downloads latest artifact from S3 via the instance role
- Compares BUILD_ID — no-op if the running build matches (safe to run every minute)
- Atomic dir swap: `app.new` → `app`, old `app` → `app.previous`
- Restarts `kokkok.service` + health-check retry loop
- **Rolls back on health-check failure** — `app.previous` restored, failed build saved at `app.failed` for inspection

The top comment of `infrastructure/scripts/kokkok-refresh.sh` documents every rollback path inline. CloudFront + ALB drain details from the 2026-06-25 RDS cutover are inline as comments in `infrastructure/ec2.tf` + `infrastructure/alb.tf`.

## 6. Running SQL against prod RDS

You need SSM session access (Dynamic Solution's AWS admin should have this by default). Then:

```bash
aws ssm start-session --profile kokkokgarden --target i-0d56867ef412ab182
sudo -i
# DATABASE_URL is in /etc/kokkok/env, but pg's `uselibpqcompat=true` query param
# breaks libpq — strip it before passing to psql:
RAW=$(grep '^DATABASE_URL=' /etc/kokkok/env | cut -d= -f2-)
CLEAN=$(echo "$RAW" | sed -E 's/\?uselibpqcompat=[^&]*&/?/g; s/&uselibpqcompat=[^&]*//g; s/\?uselibpqcompat=[^&]*$//')
psql "$CLEAN"
```

For migrations: same pattern, but `psql "$CLEAN" -f supabase/migrations/000000000000NN_*.sql`. Applied migrations are tracked externally (no schema-version table); check `pg_indexes` / `information_schema.columns` for what's already there.

## 7. Where things live

```
src/app/[lang]/           storefront (kr, en)
src/app/admin/            admin UI (cognito-gated via src/proxy.ts)
src/app/api/customer/     customer-facing API
src/app/api/admin/        admin API (super-admin for role/delete)
src/app/api/auth/         Cognito wrapper endpoints
src/components/           shared UI
src/lib/api/              server-side data-access dispatchers
src/lib/db/               pg query implementations
src/lib/auth/             requireAdmin / requireCustomer helpers
src/lib/cache/            unstable_cache wrappers + revalidateHomepageData
src/lib/audit/            structured PIPA audit log (PR #357)
src/lib/i18n/             translations + detectLangServer
supabase/migrations/      SQL migrations (numeric prefix, apply in order)
infrastructure/           Terraform (ALB, EC2, RDS, WAF, CloudTrail, etc.)
infrastructure/scripts/   kokkok-refresh.sh deploy script
public/                   static assets (fonts, icons)
.github/workflows/        CI (build-publish-artifact, PR checks)
```

## 8. The five things that WILL surprise you

1. **Cache invalidation is Server Actions**, not `revalidateTag` directly. `revalidateHomepageData(tag)` in `src/lib/cache/invalidate.ts` is a `'use server'` function. **Client hooks MUST `await` it** — 25 unawaited calls were the biggest silent-failure class in the codebase (PR #348).

2. **The RDS DB URL has `uselibpqcompat=true`** which is a node-pg-only query param. `psql` rejects it. Always strip before piping to `psql` (see §6).

3. **Migration files are just SQL** — no schema-version tracking. Apply idempotently (every migration uses `IF NOT EXISTS`). If you're unsure whether one's been applied: it's safe to re-run.

4. **The daily admin operator uses `/admin/homepage` as a drawer-driven editor** with live preview via postMessage. Every builder section has `data-builder-section="..."` for the highlight overlay. Don't remove those attributes.

5. **Cognito groups are the security boundary, NOT the DB `role` column.** The RDS `role` column exists for display + convenience; the actual authz check reads `cognito:groups`. When you flip an admin, you MUST call `addUserToGroup(email, 'admins')` in addition to updating RDS (`/api/admin/users/[id]` PATCH does this correctly).

## 9. What's monitored (and what isn't)

**Live monitoring:**
- ALB 5xx alarm → SNS email (see `infrastructure/monitoring.tf`)
- WAF blocked-requests metric (no alarm on it yet — see backlog)
- CloudTrail management events → `s3://kokkok-audit-logs` with 90-day retention
- `/api/health` → ALB target health check (drains on 5 consecutive 503s)
- PIPA audit trail → PR #357 emits structured JSON to CloudWatch Logs for customer.account.deleted + admin.user.role_changed + admin.user.deleted + admin.users.csv_exported

**Not monitored (know this before something goes wrong):**
- Silent chatbot-lead insert failures — customers see "thanks", operator sees nothing
- Dashboard fan-out partial failures — one bad panel = whole `/admin/dashboard` returns 500
- Slow RDS queries — no `log_min_duration_statement`
- Cognito account creation orphans — if `complete-registration` fails after Cognito succeeds, the operator can't reuse that email
- SES bounces / complaints — no SNS subscription yet
- Deploy failures beyond "GHA turned red"

## 10. Where to find things faster than reading source

- **What runs where in AWS:** `infrastructure/main.tf` outputs + `terraform state list`
- **Which migrations have run in prod:** query `information_schema.columns` for the newest column each migration adds
- **Every admin route:** `src/app/admin/_components/nav.ts` — single source of truth for the sidebar
- **All customer PII columns:** `customer_profiles` schema
- **The full customer delete cascade:** `src/lib/db/admin-writes.ts` → `deleteUserInPg`
- **The consent banner + its downstream gates:** `src/components/CookieConsent.tsx` writes the cookie; `PageTracker.tsx` + `src/app/[lang]/layout.tsx` read it. PIPA + GDPR compliance depends on this chain staying intact.

---

**Questions?** Open an issue with the `handoff` label.
