# RDS cutover runbook

**Status as of 2026-06-25:** RDS is a verified hot mirror of Supabase.
Schema + data migrated, row counts identical for all production tables
(products, categories, carousel_slides, promo_banners, analytics,
users, wishlist).

This runbook flips the live app from Supabase → RDS by toggling a
single terraform variable. The whole thing is a one-command cutover
with a one-command rollback.

---

## TL;DR

```bash
# Cutover
cd infrastructure
terraform apply -var="use_rds=true" -replace=aws_instance.app -auto-approve

# Smoke test
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://www.kokkokgarden.com/kr
# Should print: HTTP 200

# Rollback (if smoke test fails)
terraform apply -var="use_rds=false" -replace=aws_instance.app -auto-approve
```

Total downtime: 0s (zero-downtime EC2 swap via ALB target-group
drain + create-before-destroy lifecycle).

---

## Pre-cutover checklist

- [ ] Pick a low-traffic window (e.g. KST 03:00-05:00 Wed/Thu)
- [ ] Re-sync data from Supabase to catch drift since 2026-06-24
      (steps in section "Re-sync data" below)
- [ ] Confirm row counts identical again
- [ ] Have this runbook open with the rollback command visible
- [ ] Have a terminal connected and authenticated to AWS

---

## What the cutover does

`var.use_rds = true` triggers the following at the next EC2 replace:

1. EC2 user_data writes `USE_RDS=true` to the env file
2. EC2 user_data fetches the RDS master password from Secrets Manager
   (`kokkok/db/password-*`) via the `kokkok-ec2-role` instance profile
3. EC2 user_data constructs the connection string and writes
   `DATABASE_URL=postgresql://kokkok_app:<pw>@...?sslmode=require`
4. systemd starts the Next.js app with both env vars set
5. `src/lib/db/pool.ts` reads `USE_RDS === 'true'` and routes all
   data reads/writes through node-postgres to RDS
6. Supabase URL + anon key are still in the env (for any client-side
   code paths that haven't been migrated yet) but server-side reads
   no longer go to Supabase

The ALB target group's `deregistration_delay = 30s` + the lifecycle
`create_before_destroy = true` together guarantee zero downtime
during the swap.

---

## Steps

### 1. Re-sync data (catches any drift since the initial migration)

SSM into EC2 i-`$(aws ec2 describe-instances --filters "Name=tag:Name,Values=kokkok-app-*" "Name=instance-state-name,Values=running" --query 'Reservations[0].Instances[0].InstanceId' --output text)`:

```bash
aws ssm start-session --target $(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=kokkok-app-*" \
            "Name=instance-state-name,Values=running" \
  --query 'Reservations[0].Instances[0].InstanceId' --output text)
```

Once on the EC2:

```bash
# Get a fresh Supabase password — Supabase dashboard → Database → Reset password
# Save it locally to aws-credentials/supabase_db_password.txt before running this:
SUPA_PW="(paste-here-or-fetch-from-Secrets-Manager-if-staged)"
RDS_PW=$(aws secretsmanager get-secret-value \
  --secret-id "$(aws secretsmanager list-secrets \
    --filters Key=name,Values=kokkok/db --query 'SecretList[0].Name' --output text)" \
  --region ap-northeast-2 --query SecretString --output text | jq -r .password)

# Truncate + reload data (in-transaction, atomic per-table)
sudo docker run --rm -e SUPA_PW="$SUPA_PW" -e RDS_PW="$RDS_PW" postgres:17-alpine sh -c '
PGPASSWORD=$SUPA_PW pg_dump \
  -h db.auxfxdttbhhnmnutbemn.supabase.co -p 6543 -U postgres -d postgres \
  --schema=public --data-only --no-owner --no-acl --disable-triggers \
  > /tmp/data.sql && \
PGPASSWORD=$RDS_PW psql \
  -h $(aws ssm get-parameter --name /kokkok/rds/endpoint --query Parameter.Value --output text || echo "kokkok-postgres.cpyw8246k0vc.ap-northeast-2.rds.amazonaws.com") \
  -U kokkok_app -d kokkokgarden \
  -c "TRUNCATE public.products, public.categories, public.carousel_slides, public.promo_banners, public.analytics, public.users, public.wishlist CASCADE;" && \
PGPASSWORD=$RDS_PW psql \
  -h kokkok-postgres.cpyw8246k0vc.ap-northeast-2.rds.amazonaws.com \
  -U kokkok_app -d kokkokgarden \
  -v ON_ERROR_STOP=0 -f /tmp/data.sql
'
```

### 2. Fire the cutover

From your local machine, in the repo root:

```bash
cd infrastructure
terraform apply -var="use_rds=true" -replace=aws_instance.app -auto-approve
```

Terraform spends ~90 seconds replacing the EC2 with the new one.
The new EC2's user_data fetches the RDS password and writes
DATABASE_URL before systemd starts the app.

### 3. Smoke test

```bash
# Should print HTTP 200
curl -s -o /dev/null -w "HTTP %{http_code}\n" https://www.kokkokgarden.com/kr

# Verify products load from RDS (visit in browser; should see all 5)
open https://www.kokkokgarden.com/kr/products

# Admin analytics should show 4042 sessions
open https://www.kokkokgarden.com/admin/analytics
```

If anything looks wrong, **immediately** run the rollback:

```bash
terraform apply -var="use_rds=false" -replace=aws_instance.app -auto-approve
```

### 4. Post-cutover cleanup (only after 48h of stable operation)

```bash
# Cancel Supabase IPv4 add-on — saves $4/mo
# Supabase dashboard → Database → Add-ons → IPv4 → Disable

# Cancel Supabase Pro subscription — saves $20/mo (the personal-card one)
# Supabase dashboard → Settings → Billing → Cancel
```

---

## Rollback (any time, even days after cutover)

```bash
terraform apply -var="use_rds=false" -replace=aws_instance.app -auto-approve
```

The app falls back to Supabase reads. RDS keeps running (so we don't
re-pay the rebuild cost if we ever flip back). When you're confident
RDS is fine and want to actually decommission Supabase, run step 4
above.

---

## Notes for Dynamic Solution's team

- The EC2 instance profile `kokkok-ec2-role` is now wired into terraform
  (no longer needs manual attachment after each replace).
- The cutover toggle (`var.use_rds`) is in `infrastructure/variables.tf`.
- The user_data fetch logic is in `infrastructure/ec2.tf` (search for
  "RDS cutover").
- RDS host: `kokkok-postgres.cpyw8246k0vc.ap-northeast-2.rds.amazonaws.com`
- RDS DB: `kokkokgarden`
- RDS user: `kokkok_app`
- RDS password: rotates via `terraform taint random_password.rds_master`,
  Secrets Manager auto-updates.
