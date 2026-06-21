variable "region" {
  description = "Primary AWS region"
  type        = string
  default     = "ap-northeast-2"
}

variable "aws_profile" {
  description = "Local AWS CLI profile to use"
  type        = string
  default     = "kokkokgarden"
}

variable "environment" {
  description = "Environment name (prod / staging)"
  type        = string
  default     = "prod"
}

variable "project_name" {
  description = "Short project tag used in resource names"
  type        = string
  default     = "kokkok"
}

variable "domain_name" {
  description = "Public domain. Leave empty until Route 53 / ACM is wired."
  type        = string
  default     = "kokkokgarden.com"
}

# Two-phase CloudFront rollout switch. With this false (default), the
# distribution is created using the default *.cloudfront.net cert and no
# domain aliases — so the operator can test the edge cache via the
# CloudFront URL before any DNS changes. After the us-east-1 ACM cert
# validates (5–30 min after the validation CNAMEs are added to Vercel),
# flip this to true and apply again to attach the custom domain.
variable "enable_cloudfront_custom_domain" {
  description = "Attach kokkokgarden.com + www to the CloudFront distribution. Requires the us-east-1 ACM cert to be validated first (see cloudfront_cert_validation_records output)."
  type        = bool
  default     = false
}

# Secret header value CloudFront sends to the ALB so the ALB's HTTP
# listener can distinguish CloudFront-origin traffic (forward to TG)
# from direct HTTP viewers (redirect to HTTPS). Anyone who learns this
# value could bypass HTTPS by hitting the ALB directly — set it long
# and random. Stored in secrets.auto.tfvars (gitignored).
variable "cloudfront_origin_secret" {
  description = "Secret header value the ALB uses to authenticate CloudFront-origin requests on port 80. Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""
  type        = string
  sensitive   = true
  default     = ""
}

# ---- RDS ----
variable "db_instance_class" {
  type    = string
  default = "db.t4g.micro"
}

variable "db_allocated_storage_gb" {
  type    = number
  default = 20
}

variable "db_max_allocated_storage_gb" {
  type    = number
  default = 100
}

variable "db_name" {
  type    = string
  default = "kokkokgarden"
}

variable "db_username" {
  type    = string
  default = "kokkok_app"
}

# ---- EC2 ----
variable "ec2_instance_type" {
  # t4g.small temporarily — account on AWS Free Plan, only free-tier-eligible
  # instance types can be launched. Will switch to t3a.small after Dynamic
  # Solution upgrades account out of Free Plan (via reseller billing setup).
  type    = string
  default = "t4g.small"
}

variable "ec2_ami_owner" {
  type    = string
  default = "amazon"
}

# ---- Phase 1 app env vars (passed into EC2 user-data) ----
# These are baked into /etc/kokkok/env on the instance and read by systemd.
# Once Phase 2 IAM is wired, these should move to Secrets Manager.
variable "next_public_supabase_url" {
  type    = string
  default = ""
  validation {
    condition     = length(var.next_public_supabase_url) > 0
    error_message = "next_public_supabase_url must be set. Empty value produces a broken Next.js build (server falls back to MOCK data, storefront loses hero/nav/products). Set it in infrastructure/secrets.auto.tfvars (gitignored)."
  }
}

variable "next_public_supabase_anon_key" {
  type      = string
  sensitive = true
  default   = ""
  validation {
    condition     = length(var.next_public_supabase_anon_key) > 0
    error_message = "next_public_supabase_anon_key must be set. Set it in infrastructure/secrets.auto.tfvars (gitignored)."
  }
}

variable "openai_api_key" {
  type      = string
  sensitive = true
  default   = ""
}

# Salt mixed into the SHA-256 IP hash before persisting to
# analytics.ip_hash. Keeps the hash irreversible (you can't rainbow-table
# 4 billion IPv4 addresses without the salt) AND uncorrelatable across
# deployments — rotate this to invalidate every historical ip_hash.
# Falls back to the Supabase URL inside /api/track if empty, which works
# but isn't as strong as a dedicated secret.
variable "analytics_ip_salt" {
  type        = string
  sensitive   = true
  default     = ""
  description = "Server-side salt for /api/track's IP hashing. Set in secrets.auto.tfvars."
}

# ---- Monitoring ----
variable "alerts_email" {
  description = "Email address to receive CloudWatch alarm notifications. AWS sends a one-click confirmation link to this address on first apply — alarms fire silently until that link is clicked."
  type        = string
  default     = "jeonhs9110@gmail.com"
}
