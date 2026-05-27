# ALB access logs → S3. Per-request log of method, path, status, user
# agent, response time. Critical for:
#   - debugging "the site was slow at 3pm" — go look at the log
#   - WAF tuning — confirm a blocked request was actually malicious
#   - traffic analysis without spinning up Athena later
#
# ALB writes to S3 via an AWS-owned principal (account 600734575887 for
# ap-northeast-2 — see AWS docs). That principal needs PutObject on the
# bucket; the policy below grants exactly that and nothing more.

resource "aws_s3_bucket" "alb_logs" {
  bucket        = "${var.project_name}-alb-logs"
  force_destroy = false
  tags          = { Name = "${var.project_name}-alb-logs" }
}

resource "aws_s3_bucket_public_access_block" "alb_logs" {
  bucket                  = aws_s3_bucket.alb_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# 30-day retention — after that the data has no debugging value.
# Saves us from a slow S3 bill creep.
resource "aws_s3_bucket_lifecycle_configuration" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  rule {
    id     = "expire-old-logs"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }
  }
}

# Region-specific ELB service account. ap-northeast-2 = 600734575887.
# Source: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/enable-access-logging.html#access-logging-bucket-permissions
data "aws_elb_service_account" "main" {}

resource "aws_s3_bucket_policy" "alb_logs" {
  bucket = aws_s3_bucket.alb_logs.id
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowELBToWriteLogs"
        Effect    = "Allow"
        Principal = { AWS = data.aws_elb_service_account.main.arn }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.alb_logs.arn}/AWSLogs/*"
      },
      {
        Sid       = "AllowELBLogDeliveryAcl"
        Effect    = "Allow"
        Principal = { Service = "delivery.logs.amazonaws.com" }
        Action    = "s3:GetBucketAcl"
        Resource  = aws_s3_bucket.alb_logs.arn
      },
      {
        Sid       = "AllowELBLogDeliveryWrite"
        Effect    = "Allow"
        Principal = { Service = "delivery.logs.amazonaws.com" }
        Action    = "s3:PutObject"
        Resource  = "${aws_s3_bucket.alb_logs.arn}/AWSLogs/*"
        Condition = {
          StringEquals = { "s3:x-amz-acl" = "bucket-owner-full-control" }
        }
      },
    ]
  })
}
