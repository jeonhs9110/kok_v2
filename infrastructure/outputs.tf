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

# ─────────────────────────────────────────────────────────────────────
# SES domain verification — DNS records the operator must add at
# Vercel's DNS dashboard for kokkokgarden.com.
#
# After `terraform apply`, run:
#   terraform output ses_dns_records
# and add each entry to Vercel. SES will auto-verify within ~5-30 min
# of the records becoming visible.
# ─────────────────────────────────────────────────────────────────────

output "ses_domain_verification_token" {
  description = "TXT record value for _amazonses.<domain>. One-time SES domain ownership proof."
  value       = aws_ses_domain_identity.kokkokgarden.verification_token
}

output "ses_dkim_tokens" {
  description = "DKIM selector tokens. Each one becomes a CNAME at <token>._domainkey.<domain>."
  value       = aws_ses_domain_dkim.kokkokgarden.dkim_tokens
}

output "ses_dns_records" {
  description = "Human-readable list of every DNS record to add at Vercel for SES + DKIM + SPF + DMARC. Copy each name+value into the Vercel dashboard."
  value = concat(
    [
      {
        type  = "TXT"
        name  = "_amazonses.${var.domain_name}"
        value = aws_ses_domain_identity.kokkokgarden.verification_token
        ttl   = 1800
        note  = "SES domain ownership proof (one-time)."
      },
      {
        type  = "TXT"
        name  = "mail.${var.domain_name}"
        value = "v=spf1 include:amazonses.com ~all"
        ttl   = 1800
        note  = "SPF authorizing SES to send from mail.kokkokgarden.com."
      },
      {
        type  = "MX"
        name  = "mail.${var.domain_name}"
        value = "10 feedback-smtp.${var.region}.amazonses.com"
        ttl   = 1800
        note  = "SES bounce/complaint return path."
      },
      {
        type  = "TXT"
        name  = "_dmarc.${var.domain_name}"
        value = "v=DMARC1; p=none; rua=mailto:dmarc-reports@${var.domain_name}; pct=100; aspf=r; adkim=r"
        ttl   = 1800
        note  = "DMARC policy. p=none = monitor only; switch to quarantine/reject after 30 days of clean reports."
      },
    ],
    [
      for t in aws_ses_domain_dkim.kokkokgarden.dkim_tokens : {
        type  = "CNAME"
        name  = "${t}._domainkey.${var.domain_name}"
        value = "${t}.dkim.amazonses.com"
        ttl   = 1800
        note  = "DKIM signing key (one of three)."
      }
    ],
  )
}

output "ses_domain_arn" {
  description = "ARN of the SES sending identity. Passed into Cognito's email_configuration.source_arn in phase 2 once DNS is verified."
  value       = aws_ses_domain_identity.kokkokgarden.arn
}
