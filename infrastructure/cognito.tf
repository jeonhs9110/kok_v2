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

  # SES integration deferred — Cognito ships ~50 emails/day from default sender,
  # enough for initial smoke testing. Production will wire SES once verified.
  email_configuration {
    email_sending_account = "COGNITO_DEFAULT"
  }

  tags = { Name = "${var.project_name}-users" }
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
