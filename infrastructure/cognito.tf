resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  # 8 chars, mixed case, number, symbol. Mirrors the frontend
  # validator in src/lib/auth/passwordPolicy.ts so the server-side
  # rejection message and the inline checklist agree. Existing accounts
  # keep their current passwords — Cognito only enforces this for new
  # passwords (sign-up, ForgotPassword reset, AdminSetUserPassword).
  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  account_recovery_setting {
    recovery_mechanism {
      name     = "verified_email"
      priority = 1
    }
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
    string_attribute_constraints {
      min_length = 5
      max_length = 256
    }
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true
    string_attribute_constraints {
      min_length = 0
      max_length = 256
    }
  }

  admin_create_user_config {
    allow_admin_create_user_only = false
  }

  # Conditional SES wiring. While use_ses_for_cognito is false
  # (default), Cognito falls back to its built-in sender — used for
  # smoke testing until DNS is verified and SES production access is
  # granted. When true, Cognito signs every outbound email with our
  # DKIM key and From: noreply@kokkokgarden.com so Gmail/Outlook
  # accept it instead of routing to spam.
  email_configuration {
    email_sending_account  = var.use_ses_for_cognito ? "DEVELOPER" : "COGNITO_DEFAULT"
    from_email_address     = var.use_ses_for_cognito ? "KOKKOK GARDEN <noreply@${var.domain_name}>" : null
    source_arn             = var.use_ses_for_cognito ? aws_ses_domain_identity.kokkokgarden.arn : null
    reply_to_email_address = var.use_ses_for_cognito ? "support@${var.domain_name}" : null
  }

  # KOKKOK-branded verification email. Replaces the generic
  #   "Your verification code is {####}"
  # default. Bilingual (Korean primary + English secondary) matches the
  # storefront language toggle.
  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject        = "[KOKKOK GARDEN] 이메일 인증 / Verify your email"
    email_message        = <<-EOT
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; max-width:560px; margin:0 auto; padding:24px;">
        <h2 style="font-weight:800; letter-spacing:0.04em; color:#1f2937; margin:0 0 8px;">KOKKOK GARDEN</h2>
        <p style="color:#6b7280; font-size:13px; margin:0 0 24px;">콕콕가든 회원가입 인증</p>
        <p style="color:#1f2937; font-size:15px; line-height:1.6;">아래 6자리 코드를 회원가입 화면에 입력해주세요.</p>
        <p style="color:#1f2937; font-size:15px; line-height:1.6; margin-bottom:24px;">Enter the 6-digit code below on the signup screen to verify your email.</p>
        <div style="background:#f9fafb; border:1px solid #e5e7eb; border-radius:8px; padding:24px; text-align:center; margin:8px 0 24px;">
          <p style="color:#9ca3af; font-size:11px; letter-spacing:0.2em; margin:0 0 8px;">VERIFICATION CODE</p>
          <p style="font-size:32px; letter-spacing:0.3em; font-weight:800; color:#1f2937; margin:0;">{####}</p>
        </div>
        <p style="color:#9ca3af; font-size:12px; line-height:1.6;">이 코드는 24시간 동안 유효합니다. 본인이 요청하지 않은 경우 이 메일을 무시하셔도 됩니다.</p>
        <p style="color:#9ca3af; font-size:12px; line-height:1.6;">This code is valid for 24 hours. If you did not request this, you can safely ignore this email.</p>
        <hr style="border:0; border-top:1px solid #e5e7eb; margin:24px 0;">
        <p style="color:#9ca3af; font-size:11px;">KOKKOK GARDEN · https://www.kokkokgarden.com</p>
      </div>
    EOT
  }

  # Deletion protection on the user pool. A fat-fingered `terraform destroy`
  # would otherwise wipe every account, group membership, and password
  # hash with no way to recover. Flip to "INACTIVE" + apply before any
  # intentional destroy.
  deletion_protection = "ACTIVE"

  tags = { Name = "${var.project_name}-users" }

  lifecycle {
    # User pools are effectively immutable once production traffic lands —
    # accidentally replacing one invalidates every signed-in session and
    # forces every customer to re-register. Make Terraform refuse the
    # destroy step of a replace.
    prevent_destroy = true
  }
}

# Super-admins — top of the role hierarchy. Owns role management +
# customer deletion + audit-log access. Bootstrap manually after the
# first terraform apply that creates the group:
#   aws cognito-idp admin-add-user-to-group \
#     --user-pool-id ${aws_cognito_user_pool.main.id} \
#     --username <owner-email> \
#     --group-name super_admins
# At handoff, super_admins stays with the account owner while regular
# admins go to Dynamic Solution's daily operator.
resource "aws_cognito_user_group" "super_admins" {
  name         = "super_admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Site super-administrators (master key)"
  precedence   = 0
}

# Group for admin users (lets the app gate /admin via group membership)
resource "aws_cognito_user_group" "admins" {
  name         = "admins"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Site administrators"
  precedence   = 1
}

resource "aws_cognito_user_group" "customers" {
  name         = "customers"
  user_pool_id = aws_cognito_user_pool.main.id
  description  = "Storefront customers"
  precedence   = 10
}

# App client — Next.js will use this for sign-in/up
resource "aws_cognito_user_pool_client" "web" {
  name         = "${var.project_name}-web"
  user_pool_id = aws_cognito_user_pool.main.id

  generate_secret        = false
  refresh_token_validity = 30
  access_token_validity  = 1
  id_token_validity      = 1
  token_validity_units {
    refresh_token = "days"
    access_token  = "hours"
    id_token      = "hours"
  }

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  prevent_user_existence_errors = "ENABLED"
}

# Cognito outputs live in outputs.tf alongside the other module-level
# values. See cognito_user_pool_id / cognito_client_id /
# cognito_user_pool_endpoint / cognito_admin_group_name there.
