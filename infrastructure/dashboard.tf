# Single-page operator view of the storefront's health. Open this in
# the AWS console when 송이 / a customer reports something feels off
# — five seconds to a yes/no on whether the site is degraded.
#
# Widgets are arranged left→right, top→bottom in roughly the order an
# operator would scan during an incident:
#   1. Healthy host count       — is the site even up?
#   2. Request count             — are users hitting it at all?
#   3. 5xx from backend          — is the app crashing?
#   4. p95 latency               — are responses slow?
#   5. EC2 CPU                   — is the box overloaded?
#   6. ALB target response time  — full distribution, not just p95
#
# Cost: dashboards are free, queries are pay-per-use but negligible
# at the scale of one operator checking ~hourly. <$1/month.

resource "aws_cloudwatch_dashboard" "main" {
  dashboard_name = "${var.project_name}-prod"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0, y = 0, width = 8, height = 6
        properties = {
          title   = "Healthy hosts in target group"
          region  = var.region
          stacked = false
          view    = "timeSeries"
          metrics = [
            ["AWS/ApplicationELB", "HealthyHostCount",   "TargetGroup", aws_lb_target_group.app.arn_suffix, "LoadBalancer", aws_lb.main.arn_suffix],
            [".",                  "UnHealthyHostCount", ".",           ".",                                ".",            "."],
          ]
          yAxis = { left = { min = 0 } }
        }
      },
      {
        type   = "metric"
        x      = 8, y = 0, width = 8, height = 6
        properties = {
          title   = "Request rate"
          region  = var.region
          stacked = false
          view    = "timeSeries"
          metrics = [
            ["AWS/ApplicationELB", "RequestCount", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "Sum", period = 60 }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 16, y = 0, width = 8, height = 6
        properties = {
          title   = "5xx (backend + ALB)"
          region  = var.region
          stacked = false
          view    = "timeSeries"
          metrics = [
            ["AWS/ApplicationELB", "HTTPCode_Target_5XX_Count", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "Sum", period = 60, label = "5xx from app" }],
            [".",                  "HTTPCode_ELB_5XX_Count",    ".",            ".",                    { stat = "Sum", period = 60, label = "5xx from ALB" }],
          ]
        }
      },
      {
        type   = "metric"
        x      = 0, y = 6, width = 12, height = 6
        properties = {
          title   = "Target response time — p50 / p95 / p99"
          region  = var.region
          stacked = false
          view    = "timeSeries"
          metrics = [
            ["AWS/ApplicationELB", "TargetResponseTime", "LoadBalancer", aws_lb.main.arn_suffix, { stat = "p50", label = "p50" }],
            ["...",                                                                                  { stat = "p95", label = "p95" }],
            ["...",                                                                                  { stat = "p99", label = "p99" }],
          ]
          yAxis = { left = { min = 0 } }
        }
      },
      {
        type   = "metric"
        x      = 12, y = 6, width = 12, height = 6
        properties = {
          title   = "EC2 CPU"
          region  = var.region
          stacked = false
          view    = "timeSeries"
          metrics = [
            ["AWS/EC2", "CPUUtilization", "InstanceId", aws_instance.app.id],
          ]
          yAxis = { left = { min = 0, max = 100 } }
        }
      },
    ]
  })
}

output "cloudwatch_dashboard_url" {
  description = "Operator dashboard — bookmark this for incident triage"
  value       = "https://${var.region}.console.aws.amazon.com/cloudwatch/home?region=${var.region}#dashboards:name=${aws_cloudwatch_dashboard.main.dashboard_name}"
}
