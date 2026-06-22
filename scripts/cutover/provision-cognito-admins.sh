#!/usr/bin/env bash
# Provision Cognito admin users for the kokkok user pool. Each email
# passed as an argument gets:
#
#   1. Created in the user pool (admin-create-user, email verified).
#   2. Added to the 'admins' group.
#   3. Mailed a temporary password by Cognito's default email.
#
# Idempotent: skips users that already exist (UsernameExistsException)
# and skips group additions that are already in place. Safe to re-run.
#
# Usage:
#   AWS_PROFILE=kokkokgarden ./scripts/cutover/provision-cognito-admins.sh \
#     alice@kokkokgarden.com \
#     bob@kokkokgarden.com
#
# After the operator clicks the Cognito email and signs in once, the
# preflight script's "Cognito admins group populated" check will turn
# green.
set -uo pipefail

AWS_REGION="${AWS_REGION:-ap-northeast-2}"
POOL_NAME="${COGNITO_USER_POOL_NAME:-kokkok-users}"
GROUP="${COGNITO_ADMIN_GROUP:-admins}"

if [[ $# -lt 1 ]]; then
  cat <<EOF >&2
usage: $0 <email> [<email> ...]

Provisions each email as a Cognito admin in pool '$POOL_NAME'.

Env (defaults shown):
  AWS_REGION=ap-northeast-2
  COGNITO_USER_POOL_NAME=$POOL_NAME
  COGNITO_ADMIN_GROUP=$GROUP
EOF
  exit 2
fi

pool_id=$(aws cognito-idp list-user-pools --max-results 60 --region "$AWS_REGION" \
  --query "UserPools[?Name=='$POOL_NAME'].Id | [0]" --output text 2>/dev/null || echo None)
if [[ "$pool_id" == "None" || -z "$pool_id" ]]; then
  echo "✗ no Cognito user pool named '$POOL_NAME' in $AWS_REGION" >&2
  exit 1
fi
echo "Pool: $pool_id  (group: $GROUP)"

# Verify the group exists once up front instead of per-user.
if ! aws cognito-idp get-group --user-pool-id "$pool_id" --group-name "$GROUP" \
       --region "$AWS_REGION" >/dev/null 2>&1; then
  echo "✗ no group '$GROUP' in pool $pool_id" >&2
  echo "  (the terraform creates it; run terraform apply on the cognito.tf module first)" >&2
  exit 1
fi

created=0; existing=0; failed=0
for email in "$@"; do
  email_lc=$(echo "$email" | tr 'A-Z' 'a-z')
  printf "  %-40s " "$email_lc"

  # 1. Create user — let Cognito email the temp password.
  create_err=$(aws cognito-idp admin-create-user \
    --user-pool-id "$pool_id" \
    --username "$email_lc" \
    --user-attributes "Name=email,Value=$email_lc" "Name=email_verified,Value=true" \
    --desired-delivery-mediums EMAIL \
    --region "$AWS_REGION" 2>&1 >/dev/null || true)

  if [[ -z "$create_err" ]]; then
    printf "created"
    created=$((created+1))
  elif echo "$create_err" | grep -q UsernameExistsException; then
    printf "exists "
    existing=$((existing+1))
  else
    printf "FAIL — %s\n" "$(echo "$create_err" | tail -1)"
    failed=$((failed+1))
    continue
  fi

  # 2. Add to admins group — no-op if already in it.
  if aws cognito-idp admin-add-user-to-group \
       --user-pool-id "$pool_id" \
       --username "$email_lc" \
       --group-name "$GROUP" \
       --region "$AWS_REGION" 2>/dev/null; then
    printf "  ✓ in '$GROUP'\n"
  else
    printf "  ✗ failed to add to '$GROUP'\n"
    failed=$((failed+1))
  fi
done

echo
printf "summary: created=%d  already_existed=%d  failed=%d\n" "$created" "$existing" "$failed"

if [[ "$failed" -gt 0 ]]; then
  exit 1
fi
echo "✓ done. Each new user got a Cognito email with a temporary password."
echo "  They must sign in once at https://www.kokkokgarden.com/login (after cutover)"
echo "  to set their permanent password."
