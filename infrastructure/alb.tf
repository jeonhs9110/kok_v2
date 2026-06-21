resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  # Prevents `terraform destroy` or a console "delete" click from
  # wiping the ALB and DNS-attached records. To actually delete, flip
  # this to false, apply, then delete in a second apply.
  enable_deletion_protection = true

  # Per-request log to S3. Bucket + policy in alb-logs.tf.
  access_logs {
    bucket  = aws_s3_bucket.alb_logs.id
    enabled = true
  }

  tags = { Name = "${var.project_name}-alb" }

  # Bucket policy must exist BEFORE ALB tries to write its first log,
  # otherwise the create call fails with "Access Denied for bucket".
  depends_on = [aws_s3_bucket_policy.alb_logs]
}

resource "aws_lb_target_group" "app" {
  name        = "${var.project_name}-tg"
  port        = 3000
  protocol    = "HTTP"
  vpc_id      = aws_vpc.main.id
  target_type = "instance"

  # 30s in-flight request drain when an instance deregisters during the
  # create_before_destroy swap. Users mid-request finish on the old
  # instance instead of getting cut off.
  deregistration_delay = 30

  health_check {
    # /api/health (added PR #214) is the dedicated probe that checks env
    # presence + a live Supabase ping. Previous "/" path probed the
    # storefront homepage — that's a public route that can render 200
    # even when Supabase is degraded (cached HTML), so the ALB would
    # keep an unhealthy app in rotation. The dedicated endpoint returns
    # 503 the moment Supabase ping fails, so ALB drains promptly.
    path                = "/api/health"
    port                = "3000"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    # Tighter polling so the post-build instance is recognized as healthy
    # quickly. 10s interval + 2 healthy threshold = ~20s window after the
    # app actually starts responding.
    interval            = 10
    timeout             = 6
    # /api/health returns 200 on ok, 503 on degraded — only 200 should
    # keep the target in rotation. Was 200-399 which also accepted 3xx
    # redirects from "/" (e.g. /admin → /login), masking real failures.
    matcher             = "200"
  }

  tags = { Name = "${var.project_name}-tg" }
}

resource "aws_lb_target_group_attachment" "app" {
  target_group_arn = aws_lb_target_group.app.arn
  target_id        = aws_instance.app.id
  port             = 3000

  # Every resource that references a create_before_destroy resource must
  # itself be create_before_destroy, otherwise Terraform can't sequence
  # the swap correctly (it would try to destroy the old attachment first,
  # which yanks the old instance out of the TG before the new one is
  # ready). With this set, the new attachment is created BEFORE the old
  # one is destroyed — both instances briefly live in the TG together.
  lifecycle {
    create_before_destroy = true
  }
}

# HTTP listener — 301 redirect to HTTPS. Previously this forwarded
# plaintext traffic to the app (cookies, form posts, all unencrypted).
# Now any http://www.kokkokgarden.com request gets bounced to https://
# before reaching the backend.
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type = "redirect"
    redirect {
      port        = "443"
      protocol    = "HTTPS"
      status_code = "HTTP_301"
    }
  }
}

# HTTPS listener — enabled 2026-05-22 after new ACM cert was issued.
resource "aws_lb_listener" "https" {
  load_balancer_arn = aws_lb.main.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = aws_acm_certificate.main.arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
  }
}
