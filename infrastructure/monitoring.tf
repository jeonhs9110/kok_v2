# CloudWatch alarms + SNS email alerts. Wakes the operator up when the
# site is actually broken — without this we'd only know something went
# wrong when 송이 or a customer says "사이트 안 들어가져요".
#
# Cost: SNS first 1000 emails/month free. Alarms $0.10/each → ~$0.50/mo.
# CloudWatch metrics from ALB/EC2 are free (already published).

# ---- SNS topic + email subscription ----
resource "aws_sns_topic" "alerts" {
  name = "${var.project_name}-alerts"
  tags = { Name = "${var.project_name}-alerts" }
}

# Email confirmation is REQUIRED — AWS sends a one-click confirm link
# to the address below. Until clicked, alarms fire but no email arrives.
resource "aws_sns_topic_subscription" "alerts_email" {
  topic_arn = aws_sns_topic.alerts.arn
  protocol  = "email"
  endpoint  = var.alerts_email
}

# ---- ALB: 5xx responses from the backend ----
# Any 5xx from EC2 means the app crashed / threw / OOM'd. >5 in 5min is
# already a real outage — not a single flaky request.
resource "aws_cloudwatch_metric_alarm" "alb_5xx" {
  alarm_name          = "${var.project_name}-alb-5xx"
  alarm_description   = "Backend returned 5xx — app is crashing or unreachable"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HTTPCode_Target_5XX_Count"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  statistic           = "Sum"
  threshold           = 5
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${var.project_name}-alb-5xx" }
}

# ---- Target group: any unhealthy host ----
# We run a single EC2 today, so even ONE unhealthy host = full outage.
# evaluation_periods bumped 2 -> 5 (2026-06-17): every zero-downtime
# rebuild produced a 30-60s drain window where the old instance was
# briefly counted as unhealthy, tripping the 2-minute threshold. With
# 5 minutes the drain window passes silently — only a real outage
# (5+ consecutive minutes of unhealthy) pages.
resource "aws_cloudwatch_metric_alarm" "tg_unhealthy" {
  alarm_name          = "${var.project_name}-tg-unhealthy"
  alarm_description   = "ALB target group has an unhealthy host — site is down or degraded"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 5
  metric_name         = "UnHealthyHostCount"
  namespace           = "AWS/ApplicationELB"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    TargetGroup  = aws_lb_target_group.app.arn_suffix
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  ok_actions    = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${var.project_name}-tg-unhealthy" }
}

# ---- ALB: high p95 latency ----
# 3s p95 sustained over 15min means real users are waiting. Either app
# is overloaded, DB is slow, or external API (Supabase / OpenAI) is
# degraded. Originally tuned at 2s × 10min (2 datapoints), but that
# fired every time a `terraform taint + apply` rolled the EC2 — the
# cold cache window made p95 spike briefly above 2s before the
# in-memory cache warmed. Adjusted to 3s × 15min (3 datapoints) so
# routine deploys don't page the operator while real sustained
# slowness still does. The `cache_warm_on_deploy` provisioner in
# wait.tf also pre-warms the cache before the new instance joins the
# TG, which should keep us well under threshold even during swaps.
resource "aws_cloudwatch_metric_alarm" "alb_latency_high" {
  alarm_name          = "${var.project_name}-alb-latency-p95"
  alarm_description   = "ALB target response time p95 > 3s for 15min — app is slow"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 3
  metric_name         = "TargetResponseTime"
  namespace           = "AWS/ApplicationELB"
  period              = 300
  extended_statistic  = "p95"
  threshold           = 3
  treat_missing_data  = "notBreaching"

  dimensions = {
    LoadBalancer = aws_lb.main.arn_suffix
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${var.project_name}-alb-latency-p95" }
}

# ---- EC2: CPU pegged ----
# Sustained >85% on a single t4g.small means either traffic spike or a
# runaway process. Either way, the operator should look.
resource "aws_cloudwatch_metric_alarm" "ec2_cpu_high" {
  alarm_name          = "${var.project_name}-ec2-cpu-high"
  alarm_description   = "EC2 CPU > 85% for 10min — instance overloaded"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "CPUUtilization"
  namespace           = "AWS/EC2"
  period              = 300
  statistic           = "Average"
  threshold           = 85
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = aws_instance.app.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${var.project_name}-ec2-cpu-high" }
}

# ---- EC2: StatusCheckFailed_System (notify operator) ----
# AWS-side hardware failure (host reboot, network partition). Pairs
# with the auto-recover alarm below — this one wakes the operator,
# the other triggers AWS's built-in recover-to-new-host action.
resource "aws_cloudwatch_metric_alarm" "ec2_system_check" {
  alarm_name          = "${var.project_name}-ec2-system-check-failed"
  alarm_description   = "EC2 underlying host failed — auto-recovery should kick in"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed_System"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = aws_instance.app.id
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
  tags          = { Name = "${var.project_name}-ec2-system-check-failed" }
}

# ---- EC2: auto-recover on host failure ----
# Uses the AWS built-in `arn:aws:automate:<region>:ec2:recover` action,
# which does NOT need an IAM role. When the underlying host dies, AWS
# migrates the instance to fresh hardware preserving the EBS volume,
# instance ID, and private IP — usually within 3-5min. Public IP
# changes; ALB routes via instance ID so no manual intervention
# needed for traffic to resume.
#
# Requires the instance to be EBS-backed (✓ — gp3 root volume) and on
# a Nitro hypervisor (✓ — t4g.small is Graviton-Nitro). Spinning t2.*
# instances do NOT support recover.
resource "aws_cloudwatch_metric_alarm" "ec2_auto_recover" {
  alarm_name          = "${var.project_name}-ec2-auto-recover"
  alarm_description   = "Trigger built-in EC2 recover action when StatusCheckFailed_System persists"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 2
  metric_name         = "StatusCheckFailed_System"
  namespace           = "AWS/EC2"
  period              = 60
  statistic           = "Maximum"
  threshold           = 0
  treat_missing_data  = "notBreaching"

  dimensions = {
    InstanceId = aws_instance.app.id
  }

  alarm_actions = ["arn:aws:automate:${var.region}:ec2:recover"]
  tags          = { Name = "${var.project_name}-ec2-auto-recover" }
}
