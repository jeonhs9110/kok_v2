output "alb_dns_name" {
  description = "ALB hostname (use for smoke testing before CloudFront)"
  value       = aws_lb.main.dns_name
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain (use this until custom domain is wired)"
  value       = aws_cloudfront_distribution.main.domain_name
}

output "ec2_public_ip" {
  description = "Public IP of the app EC2 instance"
  value       = aws_instance.app.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID — use with SSM Session Manager"
  value       = aws_instance.app.id
}

output "rds_endpoint" {
  description = "RDS PostgreSQL endpoint"
  value       = aws_db_instance.main.endpoint
}

output "rds_db_name" {
  value = aws_db_instance.main.db_name
}

output "rds_username" {
  value = aws_db_instance.main.username
}

output "db_password_secret_arn" {
  description = "Secrets Manager ARN holding RDS master password"
  value       = aws_secretsmanager_secret.db_password.arn
}

output "s3_storage_bucket" {
  value = aws_s3_bucket.storage.bucket
}

output "ecr_repository_url" {
  value = aws_ecr_repository.app.repository_url
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.web.id
}
