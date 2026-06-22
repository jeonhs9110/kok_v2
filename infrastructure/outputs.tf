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
  description = "Cognito user pool ID. Goes in NEXT_PUBLIC_COGNITO_USER_POOL_ID on EC2."
  value       = aws_cognito_user_pool.main.id
}

output "cognito_client_id" {
  description = "Cognito app client ID for the browser SDK. Goes in NEXT_PUBLIC_COGNITO_CLIENT_ID."
  value       = aws_cognito_user_pool_client.web.id
}

output "cognito_user_pool_endpoint" {
  description = "Issuer URL the middleware verifies the JWT `iss` claim against."
  value       = "https://cognito-idp.${var.region}.amazonaws.com/${aws_cognito_user_pool.main.id}"
}

output "cognito_admin_group_name" {
  description = "Group name to check for /admin/* gating. Middleware reads `cognito:groups` claim for this string."
  value       = aws_cognito_user_group.admins.name
}
