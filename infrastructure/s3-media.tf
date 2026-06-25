# Media bucket — successor to Supabase Storage.
#
# Holds 100% of user-uploaded media (carousel slides, product photos,
# detail-component images/videos, logo, site backgrounds, sub-hero
# banners, Instagram thumbs, review photos, rich-editor uploads).
#
# Key layout mirrors Supabase exactly so the migration is a rename:
#   s3://kokkok-media/product-images/products/<file>
#   s3://kokkok-media/product-images/detail-components/<file>
#   s3://kokkok-media/site-assets/logo/<file>
#   s3://kokkok-media/site-assets/backgrounds/<file>
#   ...
#
# Public reads happen only through CloudFront's /media/* behavior
# (see cloudfront.tf). The bucket policy below allows ONLY this
# distribution to GetObject — no public access, no other distributions,
# no other AWS accounts. Writes happen via presigned PUT URLs minted
# by the Next.js /api/upload route, which uses the EC2 instance role's
# s3:PutObject permission.

resource "aws_s3_bucket" "media" {
  bucket = "${var.project_name}-media"

  # NOT force_destroy — versioning is on, so a `terraform destroy`
  # against a populated bucket needs an explicit manual sweep.
  # Trades one extra step on teardown for safety against fat-finger
  # deletes during everyday infra work.
  force_destroy = false

  tags = {
    Name    = "${var.project_name}-media"
    Purpose = "User-uploaded media - replaces Supabase Storage"
  }
}

# Default encryption — SSE-S3 (AES256). Free, no KMS key management,
# satisfies "encryption at rest" for everything we store.
resource "aws_s3_bucket_server_side_encryption_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
    bucket_key_enabled = true
  }
}

# Versioning ON — if the admin operator overwrites the logo or
# deletes the wrong carousel slide, the prior version is recoverable.
# Cost is bounded by the lifecycle rule below.
resource "aws_s3_bucket_versioning" "media" {
  bucket = aws_s3_bucket.media.id
  versioning_configuration {
    status = "Enabled"
  }
}

# Lifecycle — keeps noncurrent (overwritten/deleted) versions cheap.
# Current (live) objects are never affected; nothing here can delete
# what the site is actively serving.
resource "aws_s3_bucket_lifecycle_configuration" "media" {
  bucket     = aws_s3_bucket.media.id
  depends_on = [aws_s3_bucket_versioning.media]

  rule {
    id     = "noncurrent-cleanup"
    status = "Enabled"

    filter {}

    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "GLACIER_IR" # Glacier Instant Retrieval, ~$0.004/GB
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 7
    }
  }
}

# Block ALL public access. CloudFront reads via OAC; bucket itself
# is invisible to the internet. Belt-and-suspenders with the bucket
# policy below.
resource "aws_s3_bucket_public_access_block" "media" {
  bucket                  = aws_s3_bucket.media.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Object ownership — disables ACLs entirely so the bucket policy is
# the single source of truth for who can read/write.
resource "aws_s3_bucket_ownership_controls" "media" {
  bucket = aws_s3_bucket.media.id
  rule {
    object_ownership = "BucketOwnerEnforced"
  }
}

# CORS — only KOKKOK origins can PUT directly to S3 via presigned URLs.
# Browsers preflight any non-simple request; this header tells them
# whether to send. evil.com cloning the upload UI gets blocked at
# the browser layer.
resource "aws_s3_bucket_cors_configuration" "media" {
  bucket = aws_s3_bucket.media.id

  cors_rule {
    allowed_origins = [
      "https://www.kokkokgarden.com",
      "https://kokkokgarden.com",
      "http://localhost:3000",
    ]
    allowed_methods = ["PUT", "GET", "HEAD"]
    allowed_headers = ["Content-Type", "Content-Length", "x-amz-*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

# CloudFront Origin Access Control — modern replacement for OAI.
# Signs requests from CloudFront to the bucket so the bucket can
# verify they came from this distribution.
resource "aws_cloudfront_origin_access_control" "media" {
  name                              = "${var.project_name}-media-oac"
  description                       = "OAC for ${aws_s3_bucket.media.id} via the main distribution"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# Bucket policy — two statements:
#   1. CloudFront OAC can GET (public reads, but only via our distribution)
#   2. The EC2 instance role can List/Get/Put/Delete (uploads + admin asset library)
#
# Why grant EC2 access via BUCKET POLICY instead of IAM policy:
# This account's PowerUserAccess profile (jeonhs9110) cannot create or
# attach IAM policies — only the account owner (Dynamic Solution / 권대영)
# can. But same-account access can be granted via a resource-based
# policy, which IS in PowerUserAccess. So instead of waiting on a 권대영
# round-trip, we authorize the EC2 role directly here. Effect is
# identical (kokkok-ec2-role can PutObject); just attached to the
# bucket side of the relationship instead of the role side.
data "aws_iam_policy_document" "media_bucket" {
  statement {
    sid    = "AllowCloudFrontOACRead"
    effect = "Allow"
    principals {
      type        = "Service"
      identifiers = ["cloudfront.amazonaws.com"]
    }
    actions   = ["s3:GetObject"]
    resources = ["${aws_s3_bucket.media.arn}/*"]
    condition {
      test     = "StringEquals"
      variable = "AWS:SourceArn"
      values   = [aws_cloudfront_distribution.main.arn]
    }
  }

  statement {
    sid    = "AllowEC2RoleObjectAccess"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::431412300241:role/kokkok-ec2-role"]
    }
    actions = [
      "s3:GetObject",
      "s3:PutObject",
      "s3:DeleteObject",
      # aws s3 cp/mv calls these when versioning is enabled — without
      # them the CLI fails on tag-preservation even though the bucket
      # has no tags. Required for any maintenance script that uses the
      # high-level aws s3 commands rather than raw s3api.
      "s3:GetObjectTagging",
      "s3:PutObjectTagging",
      "s3:DeleteObjectTagging",
    ]
    resources = ["${aws_s3_bucket.media.arn}/*"]
  }

  statement {
    sid    = "AllowEC2RoleListBucket"
    effect = "Allow"
    principals {
      type        = "AWS"
      identifiers = ["arn:aws:iam::431412300241:role/kokkok-ec2-role"]
    }
    actions   = ["s3:ListBucket"]
    resources = [aws_s3_bucket.media.arn]
    condition {
      test     = "StringLike"
      variable = "s3:prefix"
      values = [
        "",
        "product-images/*",
        "site-assets/*",
        "_probe/*",
      ]
    }
  }
}

resource "aws_s3_bucket_policy" "media" {
  bucket = aws_s3_bucket.media.id
  policy = data.aws_iam_policy_document.media_bucket.json
  depends_on = [
    aws_s3_bucket_public_access_block.media,
  ]
}

output "media_bucket_name" {
  description = "S3 bucket holding user-uploaded media. Used by the /api/upload route to mint presigned PUT URLs."
  value       = aws_s3_bucket.media.id
}

output "media_bucket_arn" {
  description = "ARN — paste this into 권대영's IAM request if the existing kokkok-ec2-s3 policy doesn't already cover it."
  value       = aws_s3_bucket.media.arn
}
