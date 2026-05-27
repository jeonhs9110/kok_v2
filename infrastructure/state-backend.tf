# Backing resources for a future S3 Terraform backend. Today the
# state file lives on jeonhs9110's laptop — losing it bricks the
# infra-as-code workflow until everything is laboriously imported
# back. Once these resources exist and `terraform init` is rerun
# with the `backend "s3"` block in main.tf, state lives in S3 with
# per-apply locking via DynamoDB.
#
# WHY NOT FLIP THE BACKEND IN THE SAME APPLY:
# `terraform init -migrate-state` is interactive (prompts to confirm
# pulling state into the new backend) and absolutely shouldn't run
# inside a normal `terraform apply` flow. This commit only creates
# the resources; a follow-up commit adds the backend block and the
# operator runs the migration manually with proper care.

resource "aws_s3_bucket" "tfstate" {
  bucket = "${var.project_name}-tfstate"
  tags   = { Name = "${var.project_name}-tfstate" }
}

resource "aws_s3_bucket_public_access_block" "tfstate" {
  bucket                  = aws_s3_bucket.tfstate.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# Versioning is CRITICAL for state buckets — a bad apply can be
# rolled back by restoring the prior state version.
resource "aws_s3_bucket_versioning" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  versioning_configuration { status = "Enabled" }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tfstate" {
  bucket = aws_s3_bucket.tfstate.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# DynamoDB lock table — prevents two concurrent `terraform apply`
# runs from corrupting state. On-demand pricing → ~$0/month for our
# scale (a few applies a week).
resource "aws_dynamodb_table" "tfstate_lock" {
  name         = "${var.project_name}-tfstate-lock"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = { Name = "${var.project_name}-tfstate-lock" }
}

output "tfstate_backend_bucket" {
  description = "S3 bucket for Terraform state. To migrate, add a backend block to main.tf and run `terraform init -migrate-state`."
  value       = aws_s3_bucket.tfstate.bucket
}

output "tfstate_backend_lock_table" {
  description = "DynamoDB table for state locking. Reference in the same backend block."
  value       = aws_dynamodb_table.tfstate_lock.name
}
