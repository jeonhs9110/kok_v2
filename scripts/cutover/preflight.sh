#!/usr/bin/env bash
# Phase F preflight — single command you run on cutover day to verify
# every dependency is ready BEFORE flipping the USE_* flags.
#
# Each check prints ✓ or ✗ and a one-line reason. Exits non-zero if
# any required check fails so you can wire it into a Makefile target
# or a CI gate without parsing output.
#
# Usage:
#   AWS_PROFILE=kokkokgarden ./scripts/cutover/preflight.sh
#
# Optional env (defaults shown):
#   AWS_REGION=ap-northeast-2
#   PROJECT_NAME=kokkok                       # for tag/name lookups
#   S3_STORAGE_BUCKET=kokkok-storage-beb226   # from terraform output
#   COGNITO_USER_POOL_NAME=kokkok-users
#   COGNITO_ADMIN_GROUP=admins
#   STOREFRONT_URL=https://www.kokkokgarden.com
#   S3_PUBLIC_CDN_URL=                        # set when CloudFront is wired
#
# What this script does NOT do:
# - Touch RDS or S3 contents (read-only).
# - Trigger a deploy. That's the next step AFTER everything is green.
# - Validate row counts (needs to run from EC2; see scripts/db/05-verify.sh).
set -uo pipefail

AWS_REGION="${AWS_REGION:-ap-northeast-2}"
PROJECT_NAME="${PROJECT_NAME:-kokkok}"
S3_STORAGE_BUCKET="${S3_STORAGE_BUCKET:-kokkok-storage-beb226}"
COGNITO_USER_POOL_NAME="${COGNITO_USER_POOL_NAME:-kokkok-users}"
COGNITO_ADMIN_GROUP="${COGNITO_ADMIN_GROUP:-admins}"
STOREFRONT_URL="${STOREFRONT_URL:-https://www.kokkokgarden.com}"
S3_PUBLIC_CDN_URL="${S3_PUBLIC_CDN_URL:-}"

pass_count=0
fail_count=0
warn_count=0

check() {
  local status="$1"; local label="$2"; local detail="$3"
  case "$status" in
    pass) printf "  \033[32m✓\033[0m  %-46s %s\n" "$label" "$detail"; pass_count=$((pass_count+1)) ;;
    fail) printf "  \033[31m✗\033[0m  %-46s %s\n" "$label" "$detail"; fail_count=$((fail_count+1)) ;;
    warn) printf "  \033[33m!\033[0m  %-46s %s\n" "$label" "$detail"; warn_count=$((warn_count+1)) ;;
  esac
}

section() {
  printf "\n\033[1m═══ %s ═══\033[0m\n" "$1"
}

# ─── 1. AWS auth ──────────────────────────────────────────────────
section "AWS authentication"
if caller=$(aws sts get-caller-identity --output json 2>/dev/null); then
  acct=$(echo "$caller" | grep -oE '"Account": "[0-9]+"' | grep -oE '[0-9]+')
  arn=$(echo "$caller" | grep -oE '"Arn": "[^"]+"' | sed 's/"Arn": "//; s/"$//')
  check pass "AWS CLI authenticated" "account=$acct arn=$arn"
else
  check fail "AWS CLI authenticated" "aws sts get-caller-identity failed (check AWS_PROFILE)"
  echo
  echo "Bailing — every later check needs AWS auth."
  exit 1
fi

# ─── 2. EC2 instance ──────────────────────────────────────────────
section "EC2 instance"
ec2_json=$(aws ec2 describe-instances \
  --filters "Name=tag:Name,Values=${PROJECT_NAME}-app-*" "Name=instance-state-name,Values=running" \
  --region "$AWS_REGION" --output json 2>/dev/null || echo '{}')
instance_id=$(echo "$ec2_json" | grep -oE '"InstanceId": "i-[a-f0-9]+"' | head -1 | sed 's/.*"\(i-[a-f0-9]\+\)".*/\1/')
if [[ -n "$instance_id" ]]; then
  check pass "EC2 instance running" "$instance_id"
  # Does it have an IAM profile attached (the PassRole gate)?
  if echo "$ec2_json" | grep -q '"IamInstanceProfile"'; then
    profile_arn=$(echo "$ec2_json" | grep -oE '"Arn": "arn:aws:iam::[0-9]+:instance-profile/[^"]+"' | head -1 | sed 's/"Arn": "//; s/"$//')
    check pass "EC2 has IAM instance profile" "$profile_arn"
  else
    check fail "EC2 has IAM instance profile" "blocked on iam:PassRole — see 권대영's pending email"
  fi
else
  check fail "EC2 instance running" "no matching instance (filter: tag:Name=${PROJECT_NAME}-app-*)"
fi

# ─── 3. SSM agent connectivity ────────────────────────────────────
section "SSM (remote command path)"
if [[ -n "$instance_id" ]]; then
  ssm_status=$(aws ssm describe-instance-information \
    --filters "Key=InstanceIds,Values=$instance_id" \
    --region "$AWS_REGION" --query 'InstanceInformationList[0].PingStatus' --output text 2>/dev/null || echo None)
  if [[ "$ssm_status" == "Online" ]]; then
    check pass "SSM agent online" "ssm:send-command will work"
  else
    check fail "SSM agent online" "status=$ssm_status (needs PassRole grant + agent install)"
  fi
fi

# ─── 4. RDS ───────────────────────────────────────────────────────
section "RDS Postgres"
rds_json=$(aws rds describe-db-instances --db-instance-identifier "${PROJECT_NAME}-postgres" \
  --region "$AWS_REGION" --output json 2>/dev/null || echo '{}')
rds_status=$(echo "$rds_json" | grep -oE '"DBInstanceStatus": "[a-z]+"' | head -1 | sed 's/.*"\([a-z]\+\)".*/\1/')
rds_endpoint=$(echo "$rds_json" | grep -oE '"Address": "[^"]+"' | head -1 | sed 's/"Address": "//; s/"$//')
if [[ "$rds_status" == "available" ]]; then
  check pass "RDS available" "$rds_endpoint"
else
  check fail "RDS available" "status=$rds_status"
fi

# Secret with the RDS password — verify access, never print the value.
# Terraform names it 'kokkok/db/password-<random_suffix>' so we look it up
# by prefix instead of exact name.
secret_arn=$(aws secretsmanager list-secrets --region "$AWS_REGION" \
  --query "SecretList[?starts_with(Name, '${PROJECT_NAME}/db/password')].ARN | [0]" \
  --output text 2>/dev/null || echo None)
if [[ "$secret_arn" != "None" && -n "$secret_arn" ]]; then
  if aws secretsmanager get-secret-value --secret-id "$secret_arn" --region "$AWS_REGION" >/dev/null 2>&1; then
    check pass "RDS password readable" "${secret_arn##*:secret:}"
  else
    check fail "RDS password readable" "secret exists but get-secret-value denied"
  fi
else
  check fail "RDS password readable" "no secret starting with ${PROJECT_NAME}/db/password"
fi

# ─── 5. S3 storage bucket + CloudFront ────────────────────────────
section "S3 storage + CDN"
if aws s3api head-bucket --bucket "$S3_STORAGE_BUCKET" --region "$AWS_REGION" >/dev/null 2>&1; then
  # list-objects-v2 returns "None" (text) for KeyCount when the bucket is
  # empty — normalize to 0 so the arithmetic comparison doesn't break.
  obj_count_raw=$(aws s3api list-objects-v2 --bucket "$S3_STORAGE_BUCKET" --max-items 1 \
    --query 'KeyCount' --output text 2>/dev/null || echo 0)
  obj_count="${obj_count_raw:-0}"
  [[ "$obj_count" == "None" ]] && obj_count=0
  if [[ "$obj_count" -gt 0 ]]; then
    total=$(aws s3 ls "s3://$S3_STORAGE_BUCKET" --recursive --summarize 2>/dev/null \
      | grep -E 'Total Objects' | awk '{print $3}')
    total="${total:-?}"
    check pass "S3 bucket has objects" "$total objects (mirror script ran)"
  else
    check fail "S3 bucket has objects" "empty bucket (run scripts/storage/mirror-supabase-to-s3.mjs)"
  fi
else
  check fail "S3 bucket exists" "$S3_STORAGE_BUCKET not found in $AWS_REGION"
fi

if [[ -n "$S3_PUBLIC_CDN_URL" ]]; then
  if curl -sf -o /dev/null --max-time 5 "$S3_PUBLIC_CDN_URL/site-assets/" 2>/dev/null \
     || curl -sf -o /dev/null --max-time 5 "$S3_PUBLIC_CDN_URL" 2>/dev/null; then
    check pass "CloudFront in front of S3" "$S3_PUBLIC_CDN_URL"
  else
    check warn "CloudFront in front of S3" "$S3_PUBLIC_CDN_URL set but didn't respond 200 — verify origin config"
  fi
else
  check warn "CloudFront in front of S3" "S3_PUBLIC_CDN_URL unset (storefront images will 403 from the bucket)"
fi

# ─── 6. Cognito ───────────────────────────────────────────────────
section "Cognito"
pool_id=$(aws cognito-idp list-user-pools --max-results 60 --region "$AWS_REGION" \
  --query "UserPools[?Name=='$COGNITO_USER_POOL_NAME'].Id | [0]" --output text 2>/dev/null || echo None)
if [[ "$pool_id" != "None" && -n "$pool_id" ]]; then
  check pass "Cognito user pool exists" "$pool_id"
  # admins group
  if aws cognito-idp get-group --user-pool-id "$pool_id" --group-name "$COGNITO_ADMIN_GROUP" \
       --region "$AWS_REGION" >/dev/null 2>&1; then
    admin_count=$(aws cognito-idp list-users-in-group --user-pool-id "$pool_id" \
      --group-name "$COGNITO_ADMIN_GROUP" --region "$AWS_REGION" \
      --query 'length(Users)' --output text 2>/dev/null || echo 0)
    if [[ "$admin_count" -gt 0 ]]; then
      check pass "Cognito admins group populated" "$admin_count user(s) in '$COGNITO_ADMIN_GROUP'"
    else
      check fail "Cognito admins group populated" "group exists but no users (cognito-idp admin-add-user-to-group)"
    fi
  else
    check fail "Cognito admins group exists" "no group named '$COGNITO_ADMIN_GROUP' in pool $pool_id"
  fi
else
  check fail "Cognito user pool exists" "no pool named '$COGNITO_USER_POOL_NAME'"
fi

# ─── 7. Latest build artifact ─────────────────────────────────────
section "Deploy artifact"
artifact_age_sec=$(aws s3api head-object --bucket "${PROJECT_NAME}-deploy-artifacts" \
  --key latest.tar.gz --region "$AWS_REGION" --query 'LastModified' --output text 2>/dev/null | \
  xargs -I{} date -d "{}" +%s 2>/dev/null || echo 0)
now_sec=$(date +%s)
if [[ "$artifact_age_sec" -gt 0 ]]; then
  age_hr=$(( (now_sec - artifact_age_sec) / 3600 ))
  if [[ "$age_hr" -lt 24 ]]; then
    check pass "latest.tar.gz fresh" "built ${age_hr}h ago"
  else
    check warn "latest.tar.gz fresh" "built ${age_hr}h ago — consider triggering a fresh build first"
  fi
else
  check fail "latest.tar.gz exists" "s3://${PROJECT_NAME}-deploy-artifacts/latest.tar.gz missing"
fi

# ─── 8. Storefront baseline (pre-cutover) ─────────────────────────
section "Storefront baseline"
if status=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$STOREFRONT_URL/kr" 2>/dev/null); then
  if [[ "$status" == "200" ]]; then
    check pass "Storefront /kr returns 200" "$STOREFRONT_URL/kr"
  else
    check fail "Storefront /kr returns 200" "got HTTP $status — investigate before cutover"
  fi
else
  check fail "Storefront /kr reachable" "curl failed against $STOREFRONT_URL"
fi

# ─── summary ──────────────────────────────────────────────────────
echo
printf "\033[1mSummary:\033[0m  \033[32m%d pass\033[0m  \033[31m%d fail\033[0m  \033[33m%d warn\033[0m\n" \
  "$pass_count" "$fail_count" "$warn_count"
echo

if [[ "$fail_count" -gt 0 ]]; then
  echo "✗ NOT READY for cutover. Resolve the failed checks above first."
  exit 1
fi
if [[ "$warn_count" -gt 0 ]]; then
  echo "! Cutover possible but verify the warnings — they often mean a config drift."
  exit 0
fi
echo "✓ All preflight checks pass. Safe to proceed with the flag flip + terraform apply."
exit 0
