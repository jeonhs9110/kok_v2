# Single-region CloudTrail. Captures every management API call (who
# created/deleted/modified what AWS resource) into a dedicated S3
# bucket. Essential for incident forensics — "who deleted the prod
# EC2 last Tuesday" becomes answerable.
#
# Cost: management events are FREE for the first copy per region.
# S3 storage ~1-10MB/month for our usage = <$0.01/month.

resource "aws_s3_bucket" "audit_logs" {
  bucket = "${var.project_name}-audit-logs"
  tags   = { Name = "${var.project_name}-audit-logs" }
}

# CloudTrail won't let you put logs in a bucket that isn't locked
# down. Block all public access.
resource "aws_s3_bucket_public_access_block" "audit_logs" {
  bucket                  = aws_s3_bucket.audit_logs.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Server-side encryption with SSE-S3 (free, AWS-managed). Audit logs
# are sensitive — don't write them plaintext.
resource "aws_s3_bucket_server_side_encryption_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Auto-expire old logs to keep cost negligible. 90 days is a reasonable
# audit window for our scale; bump to 365+ if compliance ever requires.
resource "aws_s3_bucket_lifecycle_configuration" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  rule {
    id     = "expire-old-logs"
    status = "Enabled"
    filter {}
    expiration { days = 90 }
  }
}

# CloudTrail's service principal needs write access to the bucket.
data "aws_iam_policy_document" "audit_logs_trail_write" {
  statement {
    sid     = "AWSCloudTrailAclCheck"
    effect  = "Allow"
    actions = ["s3:GetBucketAcl"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    resources = [aws_s3_bucket.audit_logs.arn]
  }
  statement {
    sid     = "AWSCloudTrailWrite"
    effect  = "Allow"
    actions = ["s3:PutObject"]
    principals {
      type        = "Service"
      identifiers = ["cloudtrail.amazonaws.com"]
    }
    resources = ["${aws_s3_bucket.audit_logs.arn}/AWSLogs/*"]
    condition {
      test     = "StringEquals"
      variable = "s3:x-amz-acl"
      values   = ["bucket-owner-full-control"]
    }
  }
}

resource "aws_s3_bucket_policy" "audit_logs" {
  bucket = aws_s3_bucket.audit_logs.id
  policy = data.aws_iam_policy_document.audit_logs_trail_write.json
}

resource "aws_cloudtrail" "main" {
  name           = "${var.project_name}-trail"
  s3_bucket_name = aws_s3_bucket.audit_logs.id

  # Single-region (cheaper). Switch to is_multi_region_trail = true
  # if/when we expand outside ap-northeast-2.
  is_multi_region_trail         = false
  include_global_service_events = true
  enable_log_file_validation    = true

  depends_on = [aws_s3_bucket_policy.audit_logs]
}
