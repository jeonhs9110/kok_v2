terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws    = { source = "hashicorp/aws",    version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.0" }
  }

  # State lives in S3 (versioned + encrypted) with DynamoDB locking. See
  # state-backend.tf for the bucket + table definitions. Migration from
  # the old local state was a one-time `terraform init -migrate-state`.
  backend "s3" {
    bucket         = "kokkok-tfstate"
    key            = "infra/terraform.tfstate"
    region         = "ap-northeast-2"
    encrypt        = true
    dynamodb_table = "kokkok-tfstate-lock"
    profile        = "kokkokgarden"
  }
}

provider "aws" {
  region  = var.region
  profile = var.aws_profile
  default_tags {
    tags = {
      Project     = "kokkokgarden"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# us-east-1 alias provider lives in route53-healthcheck.tf — re-used by
# acm-cloudfront.tf since CloudFront requires its ACM certs in us-east-1.

# Random suffix for globally-unique resource names (S3 buckets etc.)
resource "random_id" "suffix" {
  byte_length = 3
}
