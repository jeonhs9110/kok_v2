# Storage bucket for product images, hero banners, shorts thumbnails etc.
resource "aws_s3_bucket" "storage" {
  bucket        = "${var.project_name}-storage-${random_id.suffix.hex}"
  force_destroy = false
  tags          = { Name = "${var.project_name}-storage" }
}

resource "aws_s3_bucket_versioning" "storage" {
  bucket = aws_s3_bucket.storage.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Object lifecycle — archive old versions after 30 days to keep costs down
resource "aws_s3_bucket_lifecycle_configuration" "storage" {
  bucket = aws_s3_bucket.storage.id
  rule {
    id     = "transition-noncurrent"
    status = "Enabled"
    filter {}
    noncurrent_version_transition {
      noncurrent_days = 30
      storage_class   = "STANDARD_IA"
    }
    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

# CloudFront will read from S3 via OAC. Block all other public access.
resource "aws_s3_bucket_public_access_block" "storage" {
  bucket                  = aws_s3_bucket.storage.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
