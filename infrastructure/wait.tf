# Blocks `terraform apply` until the NEW aws_instance.app reports
# `healthy` in the ALB target group. Because both aws_instance.app and
# aws_lb_target_group_attachment.app are create_before_destroy, and this
# null_resource transitively depends on the new instance ID, Terraform
# sequences as:
#
#   1. Create new EC2 (boot + npm ci + build, ~5min)
#   2. Create new TG attachment (old still attached too)
#   3. RUN THIS PROVISIONER — `aws elbv2 wait target-in-service`
#      blocks until the new instance is healthy (~20-30s after the app
#      actually starts responding)
#   4. Destroy old TG attachment → old instance starts draining
#      (deregistration_delay = 30s)
#   5. Destroy old EC2
#
# Visible downtime: 0s. The TG always has at least one healthy target.

resource "null_resource" "wait_for_healthy" {
  triggers = {
    # Re-runs the wait every time the instance is replaced.
    instance_id = aws_instance.app.id
  }

  provisioner "local-exec" {
    # No `interpreter` block — let Terraform pick the OS default (cmd.exe on
    # Windows, sh on Linux). Earlier this used `bash -c` which broke when the
    # operator ran from PowerShell without Git Bash on PATH, killing the apply
    # mid-flight and leaving both old and new instances attached to the ALB.
    # The aws CLI returns non-zero on `wait` failure, which local-exec
    # surfaces as a provisioner error — no shell guard needed.
    environment = {
      AWS_PROFILE = var.aws_profile
      AWS_REGION  = var.region
    }
    command = "aws elbv2 wait target-in-service --target-group-arn ${aws_lb_target_group.app.arn} --targets Id=${aws_instance.app.id},Port=3000"
  }

  depends_on = [aws_lb_target_group_attachment.app]

  lifecycle {
    create_before_destroy = true
  }
}

# Pre-warm the in-memory cache on the freshly-rotated EC2 so the first
# real visitor doesn't pay the cold-cache cost. Runs AFTER the target
# is healthy (depends on wait_for_healthy) and BEFORE the old instance
# is deregistered (create_before_destroy), so the warm curls hit the
# new instance via the public domain (ALB routes to whichever target
# is currently in-service; with create_before_destroy both are
# briefly in-service so a few requests will hit each — that's
# acceptable for cache warmup).
#
# Why this exists: `unstable_cache` has a 60s TTL and is process-local.
# Each new EC2 starts with empty cache, so the first request after a
# swap takes 1-3s while it cold-fetches slides/products/sub-hero/promo
# from Supabase and runs the homepage SSR. CloudWatch's p95 latency
# alarm noticed the spike on every deploy. Pre-warming with 3 curls
# (slight stagger to populate all the unstable_cache buckets) means
# real visitors land on a warm cache and p95 stays at ~100ms.
resource "null_resource" "cache_warm_on_deploy" {
  triggers = {
    instance_id = aws_instance.app.id
  }

  provisioner "local-exec" {
    environment = {
      AWS_PROFILE = var.aws_profile
      AWS_REGION  = var.region
    }
    # 3 curls per locale to populate every getCached* in lib/cache/homepage.ts
    # (products, slides, promo, sub_hero, instagram, reviews, shorts).
    # Subsequent visitor requests are cache hits for the next 60s, then
    # background revalidation refreshes silently. -s -o NUL discards
    # bodies; -m 10 caps each call at 10s so a transient hiccup doesn't
    # stall the whole apply.
    command = <<-EOT
      curl -s -o NUL -m 10 https://www.kokkokgarden.com/kr
      curl -s -o NUL -m 10 https://www.kokkokgarden.com/en
      curl -s -o NUL -m 10 https://www.kokkokgarden.com/kr
      curl -s -o NUL -m 10 https://www.kokkokgarden.com/en
      curl -s -o NUL -m 10 https://www.kokkokgarden.com/kr/products
      curl -s -o NUL -m 10 https://www.kokkokgarden.com/en/products
    EOT
  }

  depends_on = [null_resource.wait_for_healthy]

  lifecycle {
    create_before_destroy = true
  }
}
