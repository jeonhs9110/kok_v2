# ECR repository for the kokkok-garden Next.js app image.
#
# Phase 1 of the GitHub → Bitbucket migration (per 권대영's stated
# environment: Jenkins + Docker, x64 only). The image is built by CI
# (GitHub Actions today, Bitbucket Pipelines after the cutover) and
# the EC2 instance pulls it on boot via the kokkok-ec2-role (which
# already has AmazonEC2ContainerRegistryReadOnly attached).
#
# Lifecycle policy keeps the registry small:
#   - Only the 10 most recent prod-master tags survive
#   - Untagged images (failed builds) expire after 3 days
# At ~250MB/image × 10 = ~2.5GB stored × $0.10/GB/mo = ~$0.25/mo.

resource "aws_ecr_repository" "app" {
  name                 = "kokkok-app"
  image_tag_mutability = "IMMUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = {
    Name        = "kokkok-app"
    Environment = "prod"
    Project     = "kokkok-garden"
  }
}

resource "aws_ecr_lifecycle_policy" "app" {
  repository = aws_ecr_repository.app.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Keep the 10 most recent prod-master images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["master-"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = { type = "expire" }
      },
      {
        rulePriority = 2
        description  = "Expire untagged images after 3 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 3
        }
        action = { type = "expire" }
      },
    ]
  })
}

output "ecr_repository_url" {
  value       = aws_ecr_repository.app.repository_url
  description = "The ECR repo URL — used by CI for `docker push` and by EC2 for `docker pull`."
}
