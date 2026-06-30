#!/usr/bin/env bash
#
# kokkok-refresh.sh — pull the latest deploy artifact from S3 and
# atomically swap it into /opt/kokkok/app, restarting the kokkok.service
# systemd unit. Designed to run via SSM Run Command (or root cron) so
# every merge to master propagates to prod without recreating the EC2
# instance.
#
# Lifecycle:
#   /opt/kokkok/app             ← currently running build
#   /opt/kokkok/app.previous    ← prior build, kept for fast rollback
#   /opt/kokkok/app.new         ← staging dir during the swap
#
# Idempotency: if the new artifact's .next/BUILD_ID matches the
# currently-running build, the script exits 0 without touching the
# service — calling this from cron every minute is safe and cheap.
#
# Rollback: if the post-restart health check fails, the script puts
# /opt/kokkok/app.previous back in place and restarts again. The
# unhealthy build is left in /opt/kokkok/app.failed for inspection.

set -euo pipefail

S3_ARTIFACT="s3://kokkok-deploy-artifacts/latest.tar.gz"
APP_DIR="/opt/kokkok/app"
APP_PREVIOUS="/opt/kokkok/app.previous"
APP_NEW="/opt/kokkok/app.new"
APP_FAILED="/opt/kokkok/app.failed"
TMP_TAR="/tmp/kokkok-new.tar.gz"
LOG_FILE="/var/log/kokkok-deploy.log"
HEALTH_URL="http://127.0.0.1:3000/api/health"
MIN_ARTIFACT_SIZE=1000000  # 1 MB sanity floor — anything smaller is a botched upload

mkdir -p /opt/kokkok
exec > >(tee -a "$LOG_FILE") 2>&1
echo "=== kokkok deploy refresh starting at $(date -Iseconds) ==="

# Fetch artifact. The EC2 instance role grants s3:GetObject on the
# deploy bucket (kokkok-ec2-role policy); no creds needed.
echo "Downloading latest artifact from $S3_ARTIFACT..."
rm -f "$TMP_TAR"
aws s3 cp "$S3_ARTIFACT" "$TMP_TAR" --no-progress

# Sanity-check artifact size before doing anything destructive — a
# stuck/half-uploaded tarball would otherwise replace a known-good
# build with garbage and we'd discover it only via the health check.
SIZE=$(stat -c%s "$TMP_TAR")
echo "Artifact size: $SIZE bytes"
if [ "$SIZE" -lt "$MIN_ARTIFACT_SIZE" ]; then
  echo "ERROR: artifact suspiciously small ($SIZE bytes < $MIN_ARTIFACT_SIZE), aborting before service interruption"
  rm -f "$TMP_TAR"
  exit 1
fi

# Stage extraction in app.new so the running build keeps serving until
# we're ready to swap.
echo "Extracting artifact to $APP_NEW..."
rm -rf "$APP_NEW"
install -d -o ec2-user -g ec2-user "$APP_NEW"
tar -xzf "$TMP_TAR" -C "$APP_NEW"
chown -R ec2-user:ec2-user "$APP_NEW"

NEW_BUILD_ID=$(cat "$APP_NEW/.next/BUILD_ID" 2>/dev/null || echo "unknown")
OLD_BUILD_ID=$(cat "$APP_DIR/.next/BUILD_ID" 2>/dev/null || echo "unknown")
echo "Old BUILD_ID: $OLD_BUILD_ID"
echo "New BUILD_ID: $NEW_BUILD_ID"

# Idempotent no-op: if BUILD_IDs match, there's nothing new to deploy.
# Cron / GHA can call this every minute safely.
if [ "$NEW_BUILD_ID" = "$OLD_BUILD_ID" ] && [ "$NEW_BUILD_ID" != "unknown" ]; then
  echo "No new build (BUILD_IDs match) — skipping service restart"
  rm -rf "$APP_NEW" "$TMP_TAR"
  exit 0
fi

# Swap. Service goes down here until the start completes (~5s on a t4g.small).
echo "Stopping kokkok.service..."
systemctl stop kokkok.service

echo "Rotating directories..."
rm -rf "$APP_PREVIOUS"
if [ -d "$APP_DIR" ]; then mv "$APP_DIR" "$APP_PREVIOUS"; fi
mv "$APP_NEW" "$APP_DIR"

echo "Starting kokkok.service..."
systemctl start kokkok.service
sleep 3

# Health check: 10 attempts at 2s intervals = up to 20s. Most boots
# pass on attempt 1; the retry loop is there for cold-start cases.
echo "Health check at $HEALTH_URL..."
HEALTHY=0
for i in 1 2 3 4 5 6 7 8 9 10; do
  if curl -fsS "$HEALTH_URL" > /tmp/kokkok-health.json 2>/dev/null; then
    echo "Health OK (attempt $i):"
    cat /tmp/kokkok-health.json
    echo
    HEALTHY=1
    break
  fi
  echo "Health attempt $i failed, retrying in 2s..."
  sleep 2
done

if [ "$HEALTHY" -ne 1 ]; then
  echo "ERROR: health check failed after 20s — rolling back to $APP_PREVIOUS"
  systemctl stop kokkok.service
  rm -rf "$APP_FAILED"
  mv "$APP_DIR" "$APP_FAILED"
  mv "$APP_PREVIOUS" "$APP_DIR"
  systemctl start kokkok.service
  rm -f "$TMP_TAR"
  echo "Rolled back. Failed build saved at $APP_FAILED for inspection."
  exit 1
fi

rm -f "$TMP_TAR"
echo "=== deploy refresh complete at $(date -Iseconds) — now running BUILD_ID $NEW_BUILD_ID ==="
