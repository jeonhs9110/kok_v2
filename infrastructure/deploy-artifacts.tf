# S3 bucket holding the GitHub-Actions-built Next.js artifact that EC2
# user_data downloads on boot. Phase 2 of the build/deploy split.
#
# WHY PUBLIC-READ: the kokkok-ec2-role instance profile that EC2
# attaches to does NOT have `s3:GetObject` on this bucket — the
# kokkok-ec2-s3 policy (provisioned by Dynamic Solution) is currently
# scoped to kokkok-media only. A 2026-06-30 attempt to switch the
# user_data fetch from `curl` to `aws s3 cp` returned 403 Forbidden
# on the role-signed HeadObject. Until 권대영 adds the deploy bucket
# to the policy, EC2 reaches the artifact via anonymous HTTPS — the
# bucket therefore needs a permissive public-read on the two artifact
# keys. (Mailbox for the request: zero@dynamicsolution.co.kr.)
#
# Risk surface: the tarball contains only client-public JS — server-
# side env (OPENAI_API_KEY, DATABASE_URL, Cognito IDs) is injected
# separately on the EC2 via terraform variables + Secrets Manager,
# never baked into the artifact. So "public artifact" exposure is
# equivalent to the client JS the storefront already serves.
#
# CLEAN MODE (when the role gains the permission): drop the public
# read policy, flip block_public_policy = true, and switch the
# user_data fetch in ec2.tf back to `aws s3 cp` (the AL2023 AMI
# ships the AWS CLI; no install step needed).

resource "aws_s3_bucket" "deploy_artifacts" {
  bucket = "${var.project_name}-deploy-artifacts"

  tags = { Name = "${var.project_name}-deploy-artifacts" }
}

resource "aws_s3_bucket_versioning" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id
  versioning_configuration { status = "Enabled" }
}

# Allow public read on just the artifact keys — block everything else.
resource "aws_s3_bucket_public_access_block" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id

  block_public_acls       = true
  ignore_public_acls      = true
  block_public_policy     = false # required so bucket_policy below can apply
  restrict_public_buckets = false
}

# Public-read policy scoped to specific keys only — `latest.tar.gz`
# for normal deploys and the `builds/*` history for rollback.
data "aws_iam_policy_document" "deploy_artifacts_public_read" {
  statement {
    sid    = "PublicReadArtifacts"
    effect = "Allow"
    principals {
      type        = "*"
      identifiers = ["*"]
    }
    actions = ["s3:GetObject"]
    resources = [
      "${aws_s3_bucket.deploy_artifacts.arn}/latest.tar.gz",
      "${aws_s3_bucket.deploy_artifacts.arn}/builds/*",
    ]
  }
}

resource "aws_s3_bucket_policy" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id
  policy = data.aws_iam_policy_document.deploy_artifacts_public_read.json

  depends_on = [aws_s3_bucket_public_access_block.deploy_artifacts]
}

# Cost-control lifecycle:
#   - builds/ (historical snapshots) → delete after 30 days
#   - latest.tar.gz noncurrent versions → delete after 7 days
resource "aws_s3_bucket_lifecycle_configuration" "deploy_artifacts" {
  bucket = aws_s3_bucket.deploy_artifacts.id

  rule {
    id     = "expire-old-builds"
    status = "Enabled"
    filter { prefix = "builds/" }
    expiration { days = 30 }
  }

  rule {
    id     = "expire-noncurrent-latest"
    status = "Enabled"
    filter { prefix = "latest.tar.gz" }
    noncurrent_version_expiration { noncurrent_days = 7 }
  }
}

output "deploy_artifacts_bucket" {
  description = "Public-read S3 bucket holding the Next.js build artifact."
  value       = aws_s3_bucket.deploy_artifacts.bucket
}

output "deploy_artifacts_latest_url" {
  description = "Public URL the EC2 user-data curls on boot."
  value       = "https://${aws_s3_bucket.deploy_artifacts.bucket}.s3.${var.region}.amazonaws.com/latest.tar.gz"
}
