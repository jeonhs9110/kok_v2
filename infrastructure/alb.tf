resource "aws_lb" "main" {
  name               = "${var.project_name}-alb"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.alb.id]
  subnets            = aws_subnet.public[*].id

  enable_deletion_protection = false # toggle to true in Phase 2
  tags                       = { Name = "${var.project_name}-alb" }
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
    path                = "/"
    port                = "3000"
    protocol            = "HTTP"
    healthy_threshold   = 2
    unhealthy_threshold = 3
    # Tighter polling so the post-build instance is recognized as healthy
    # quickly. 10s interval + 2 healthy threshold = ~20s window after the
    # app actually starts responding.
    interval            = 10
    timeout             = 6
    matcher             = "200-399"
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

# HTTP — redirect to HTTPS (set up later once ACM cert exists)
resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.main.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.app.arn
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
