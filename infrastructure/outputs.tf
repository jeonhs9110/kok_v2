output "alb_dns_name" {
  description = "ALB hostname (use for smoke testing)"
  value       = aws_lb.main.dns_name
}

output "ec2_public_ip" {
  description = "Public IP of the app EC2 instance"
  value       = aws_instance.app.public_ip
}

output "ec2_instance_id" {
  description = "EC2 instance ID — use with SSM Session Manager"
  value       = aws_instance.app.id
}

output "s3_storage_bucket" {
  value = aws_s3_bucket.storage.bucket
}

output "cognito_user_pool_id" {
  value = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  value = aws_cognito_user_pool_client.web.id
}
