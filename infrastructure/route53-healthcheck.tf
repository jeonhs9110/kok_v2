# External uptime monitoring. CloudWatch alarms know what AWS sees,
# but if our ALB looks healthy and DNS is broken — or our entire
# ap-northeast-2 region degrades — internal checks all stay green
# while real users get nothing. A Route53 health check runs from
# multiple AWS regions OUTSIDE ap-northeast-2 and hits the public
# URL the same way a customer would. If those external probes start
# failing, the user is the first to know.
#
# Cost: $0.50/month per HTTPS health check (Route53 pricing). Worth
# the rounding error vs. learning about an outage from a customer.

resource "aws_route53_health_check" "main" {
  fqdn              = "www.kokkokgarden.com"
  port              = 443
  type              = "HTTPS"
  resource_path     = "/"
  failure_threshold = 3 # ~90s of failure before flipping unhealthy
  request_interval  = 30

  # Probe from these regions. Mixing geographies avoids a single-
  # region issue masking the real status.
  regions = [
    "us-east-1",
    "us-west-2",
    "eu-west-1",
    "ap-southeast-1",
    "ap-northeast-1",
  ]

  measure_latency = true

  tags = { Name = "${var.project_name}-uptime" }
}

# Health-check status metrics are ONLY published in us-east-1 — Route53
# is a global service that pins its metrics to that region. Need a
# separate provider alias to create the alarm there.
provider "aws" {
  alias   = "us_east_1"
  region  = "us-east-1"
  profile = var.aws_profile
  default_tags {
    tags = {
      Project     = "kokkokgarden"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Mirror the SNS topic into us-east-1 so the alarm can publish to it.
# CloudWatch alarms can only target SNS topics in the same region.
resource "aws_sns_topic" "alerts_us_east_1" {
  provider = aws.us_east_1
  name     = "${var.project_name}-alerts-us-east-1"
  tags     = { Name = "${var.project_name}-alerts-us-east-1" }
}

resource "aws_sns_topic_subscription" "alerts_email_us_east_1" {
  provider  = aws.us_east_1
  topic_arn = aws_sns_topic.alerts_us_east_1.arn
  protocol  = "email"
  endpoint  = var.alerts_email
}

resource "aws_cloudwatch_metric_alarm" "uptime" {
  provider = aws.us_east_1

  alarm_name          = "${var.project_name}-external-uptime"
  alarm_description   = "Route53 external probes report www.kokkokgarden.com is DOWN. Site is unreachable from outside our region."
  comparison_operator = "LessThanThreshold"
  evaluation_periods  = 1
  metric_name         = "HealthCheckStatus"
  namespace           = "AWS/Route53"
  period              = 60
  statistic           = "Minimum"
  threshold           = 1
  treat_missing_data  = "breaching"

  dimensions = {
    HealthCheckId = aws_route53_health_check.main.id
  }

  alarm_actions = [aws_sns_topic.alerts_us_east_1.arn]
  ok_actions    = [aws_sns_topic.alerts_us_east_1.arn]
  tags          = { Name = "${var.project_name}-external-uptime" }
}
