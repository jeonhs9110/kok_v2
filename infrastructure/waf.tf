# AWS WAFv2 web ACL attached to the ALB. Two-line defense:
#   1. AWS Managed Common Rule Set — catches OWASP top-10 patterns
#      (SQL injection, XSS, command injection, path traversal, …).
#   2. Rate-based rule — caps any single client IP at 2000 requests
#      per 5min sliding window. Credential-stuffing / scrape bots get
#      a 403 once they cross that threshold.
#
# Free tier: $5/month flat + $1/rule + $0.60/million requests. For
# our traffic (<100k req/day) total is ~$8/month. Worth it vs. a
# Supabase quota burn from a script kiddie.

resource "aws_wafv2_web_acl" "main" {
  name        = "${var.project_name}-waf"
  description = "Storefront ALB protection - OWASP managed rules + IP rate limit"
  scope       = "REGIONAL"

  default_action {
    allow {}
  }

  # AWS-managed OWASP rules. `override_action.none` means the rule's
  # built-in actions (block/count) apply as-is.
  rule {
    name     = "AWSManagedRulesCommonRuleSet"
    priority = 1

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesCommonRuleSet"
        # Exclude SizeRestrictions_BODY — Next.js image uploads can
        # legitimately exceed the default 8KB body limit during admin
        # work, and admin is cookie-gated anyway.
        rule_action_override {
          name = "SizeRestrictions_BODY"
          action_to_use {
            count {}
          }
        }
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-common-rules"
    }
  }

  # Known-bad IP reputation list — AWS-curated, free.
  rule {
    name     = "AWSManagedRulesAmazonIpReputationList"
    priority = 2

    override_action {
      none {}
    }

    statement {
      managed_rule_group_statement {
        vendor_name = "AWS"
        name        = "AWSManagedRulesAmazonIpReputationList"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-ip-reputation"
    }
  }

  # Per-IP rate limit. 2000/5min = 400/min ≈ way above any human
  # browsing pattern but cuts off scraping/credential-stuffing.
  rule {
    name     = "rate-limit-per-ip"
    priority = 3

    action {
      block {}
    }

    statement {
      rate_based_statement {
        limit              = 2000
        aggregate_key_type = "IP"
      }
    }

    visibility_config {
      sampled_requests_enabled   = true
      cloudwatch_metrics_enabled = true
      metric_name                = "${var.project_name}-rate-limit"
    }
  }

  visibility_config {
    sampled_requests_enabled   = true
    cloudwatch_metrics_enabled = true
    metric_name                = "${var.project_name}-waf"
  }

  tags = { Name = "${var.project_name}-waf" }
}

resource "aws_wafv2_web_acl_association" "alb" {
  resource_arn = aws_lb.main.arn
  web_acl_arn  = aws_wafv2_web_acl.main.arn
}
