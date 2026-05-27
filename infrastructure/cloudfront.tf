# CloudFront distribution fronts the ALB.
# Two-origin setup:
#   1. ALB  → dynamic Next.js requests (default behavior)
#   2. S3   → static images via /storage/* path
resource "aws_cloudfront_origin_access_control" "s3" {
  name                              = "${var.project_name}-s3-oac"
  description                       = "OAC for ${aws_s3_bucket.storage.bucket}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} distribution"
  default_root_object = ""
  price_class         = "PriceClass_200" # NA + EU + Asia (cheaper than All)
  http_version        = "http2and3"

  # Origin 1: ALB (dynamic)
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "alb"

    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only" # CloudFront → ALB inside AWS, plain HTTP fine
      origin_ssl_protocols   = ["TLSv1.2"]
    }
  }

  # Origin 2: S3 (static images)
  origin {
    domain_name              = aws_s3_bucket.storage.bucket_regional_domain_name
    origin_id                = "s3-storage"
    origin_access_control_id = aws_cloudfront_origin_access_control.s3.id
  }

  # Default behavior — dynamic content via ALB
  default_cache_behavior {
    target_origin_id       = "alb"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # AWS managed CachingDisabled — Next.js handles its own caching
    cache_policy_id          = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad"
    origin_request_policy_id = "216adef6-5c7f-47e4-b989-5492eafa07d3" # AllViewer
  }

  # Image cache behavior — long-lived static files from S3
  ordered_cache_behavior {
    path_pattern           = "/storage/*"
    target_origin_id       = "s3-storage"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    compress               = true

    # CachingOptimized managed policy
    cache_policy_id = "658327ea-f89d-4fab-a63d-7e88639e58f6"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # No custom domain yet — use the default *.cloudfront.net hostname.
  # Once domain + ACM ready, add aliases + acm_certificate_arn here.
  viewer_certificate {
    cloudfront_default_certificate = true
  }

  tags = { Name = "${var.project_name}-cf" }
}

# S3 bucket policy — let CloudFront read via OAC
data "aws_iam_policy_document" "s3_oac" {
  statement {
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.storage.arn}/*"]
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }
}

resource "aws_s3_bucket_policy" "storage_oac" {
  bucket = aws_s3_bucket.storage.id
  policy = data.aws_iam_policy_document.s3_oac.json
}
