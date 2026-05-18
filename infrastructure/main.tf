terraform {
  required_version = ">= 1.5.0"
  required_providers {
    aws    = { source = "hashicorp/aws",    version = "~> 5.0" }
    random = { source = "hashicorp/random", version = "~> 3.0" }
  }
  # Remote state moves to S3+DynamoDB after first apply (see backend.tf-todo).
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

# Random suffix for globally-unique resource names (S3 buckets etc.)
resource "random_id" "suffix" {
  byte_length = 3
}
