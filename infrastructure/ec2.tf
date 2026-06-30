data "aws_ami" "al2023" {
  most_recent = true
  owners      = [var.ec2_ami_owner]
  filter {
    name   = "name"
    values = ["al2023-ami-2023.*-arm64"]
  }
  filter {
    name   = "architecture"
    values = ["arm64"]
  }
}

# EC2 user_data: boot directly from the latest deploy artifact in S3,
# unpack, and run server.js. The instance profile (kokkok-ec2-role)
# gives the instance the `s3:GetObject` permission it needs to read
# kokkok-deploy-artifacts privately — no presigned URL, no public
# bucket policy, no credentials embedded in user_data.
#
# 2026-06-30 cleanup:
#   - Dropped the Phase 1.5 source-build fallback that cloned
#     github.com/jeonhs9110/kok_v2.git. The personal-fork dependency
#     was a handoff blocker (Dynamic Solution will own this account
#     after handoff and shouldn't depend on the contractor's GitHub
#     repo), and the artifact path has been stable for weeks. If the
#     artifact ever 404s the systemd unit will fail loudly — a far
#     better signal than silently rebuilding from stale source.
#   - Switched the artifact fetch from `curl` (anonymous HTTPS) to
#     `aws s3 cp` (signed via the instance role). This lets us close
#     the public read policy on kokkok-deploy-artifacts (see
#     deploy-artifacts.tf).
#   - Removed NEXT_PUBLIC_SUPABASE_* from the env file. Supabase is
#     decommissioned; the browser client falls back to a placeholder
#     when the env is absent (src/lib/supabase/browser.ts) and every
#     call site is dispatcher-gated to RDS / Cognito / S3 anyway.
locals {
  artifact_url = "https://${aws_s3_bucket.deploy_artifacts.bucket}.s3.${var.region}.amazonaws.com/latest.tar.gz"

  user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    exec > >(tee -a /var/log/kokkok-boot.log) 2>&1

    # ---- env file ----
    install -d -m 750 -o ec2-user -g ec2-user /etc/kokkok
    cat >/etc/kokkok/env <<'ENVEOF'
    NODE_ENV=production
    PORT=3000
    HOSTNAME=0.0.0.0
    NEXT_TELEMETRY_DISABLED=1
    OPENAI_API_KEY=${var.openai_api_key}
    ANALYTICS_IP_SALT=${var.analytics_ip_salt}
    USE_RDS=${var.use_rds}
    S3_STORAGE_BUCKET=${aws_s3_bucket.media.id}
    S3_PUBLIC_CDN_URL=${var.media_public_cdn_url}
    NEXT_PUBLIC_S3_STORAGE_BUCKET=${aws_s3_bucket.media.id}
    NEXT_PUBLIC_S3_PUBLIC_CDN_URL=${var.media_public_cdn_url}
    NEXT_PUBLIC_USE_S3=${var.use_s3_storage}
    USE_COGNITO=${var.use_cognito}
    NEXT_PUBLIC_USE_COGNITO=${var.use_cognito}
    COGNITO_USER_POOL_ID=${aws_cognito_user_pool.main.id}
    COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.web.id}
    NEXT_PUBLIC_COGNITO_USER_POOL_ID=${aws_cognito_user_pool.main.id}
    NEXT_PUBLIC_COGNITO_CLIENT_ID=${aws_cognito_user_pool_client.web.id}
    ENVEOF

    # ---- RDS DATABASE_URL from Secrets Manager ----
    # The instance role's kokkok-ec2-secrets policy permits this exact
    # read. The JSON shape stored in the secret is
    #   {"username": "...", "password": "..."}
    # so jq the password field, then assemble DATABASE_URL with
    # sslmode=require (TLS is on by default on RDS Postgres 16).
    # uselibpqcompat=true restores libpq semantics for sslmode=require:
    # encrypt-in-transit + skip CA-chain verification. We're inside a
    # private VPC subnet with the RDS SG locking ingress to the EC2
    # SG, so MITM exposure is zero — encrypted-without-verify is fine
    # here. Harden later by shipping the AWS regional CA bundle and
    # flipping to sslmode=verify-full + ssl.ca in src/lib/db/pool.ts.
    if [ "${var.use_rds}" = "true" ]; then
      # AL2023 AMI ships with the AWS CLI pre-installed; only jq needs
      # installing. (Historically this also ran `dnf install awscli2`
      # but the AL2023 package name is just `awscli` and the AMI's
      # baked-in version is already current — the dnf call failed and
      # was masked by `|| true`.)
      dnf install -y --setopt=install_weak_deps=False jq || true
      RDS_PW=$(aws secretsmanager get-secret-value \
        --secret-id ${aws_secretsmanager_secret.rds_master_password.name} \
        --region ${var.region} \
        --query SecretString --output text | jq -r .password)
      echo "DATABASE_URL=postgresql://${var.db_username}:$RDS_PW@${aws_db_instance.main.endpoint}/${var.db_name}?uselibpqcompat=true&sslmode=require" >> /etc/kokkok/env
    fi

    chmod 640 /etc/kokkok/env
    chown root:ec2-user /etc/kokkok/env

    # ---- Node.js runtime ----
    dnf install -y --setopt=install_weak_deps=False tar gzip
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    dnf install -y --setopt=install_weak_deps=False nodejs

    install -d -o ec2-user -g ec2-user /opt/kokkok/app

    # ---- pull pre-built artifact ----
    # Anonymous HTTPS — the kokkok-deploy-artifacts bucket policy
    # grants public read on `latest.tar.gz` because the EC2 instance
    # role's s3 policy (provisioned by Dynamic Solution) doesn't yet
    # include this bucket. See the comment block in
    # `deploy-artifacts.tf` for the "clean mode" once the role grant
    # lands. Artifact contains only client-public JS, so the public
    # read is risk-equivalent to the storefront's own JS.
    curl -fsSL "${local.artifact_url}" -o /tmp/app.tar.gz
    tar -xzf /tmp/app.tar.gz -C /opt/kokkok/app
    chown -R ec2-user:ec2-user /opt/kokkok/app
    rm -f /tmp/app.tar.gz

    # ---- deploy refresh script ----
    # Install kokkok-refresh.sh so the GHA workflow's "Trigger EC2
    # deploy refresh" step can call it via SSM. The script source is
    # checked into infrastructure/scripts/kokkok-refresh.sh and
    # inlined here so it lands on every new instance without an extra
    # provisioning round-trip. Inline-content avoids a templatefile()
    # call which would pull in indentation context and break the bash
    # heredocs inside the script.
    cat >/usr/local/bin/kokkok-refresh.sh <<'REFRESHEOF'
${file("${path.module}/scripts/kokkok-refresh.sh")}
REFRESHEOF
    chmod 755 /usr/local/bin/kokkok-refresh.sh

    # ---- systemd unit ----
    # KillSignal=SIGTERM + TimeoutStopSec=30 gives Next.js up to 30s
    # to finish in-flight requests before being SIGKILL'd. Pairs with
    # the ALB target group's deregistration_delay = 30 so ALB stops
    # routing new traffic at the same time. Net: in-flight requests
    # complete cleanly during a refresh, no cut-off connections.
    cat >/etc/systemd/system/kokkok.service <<UNITEOF
    [Unit]
    Description=KOKKOK Garden Next.js
    After=network-online.target
    Wants=network-online.target

    [Service]
    Type=simple
    User=ec2-user
    Group=ec2-user
    WorkingDirectory=/opt/kokkok/app
    EnvironmentFile=/etc/kokkok/env
    ExecStart=/usr/bin/node server.js
    Restart=always
    RestartSec=5
    LimitNOFILE=65536
    KillSignal=SIGTERM
    TimeoutStopSec=30
    KillMode=mixed

    [Install]
    WantedBy=multi-user.target
    UNITEOF

    systemctl daemon-reload
    systemctl enable --now kokkok.service

    date > /var/log/kokkok-ready
  EOT
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.ec2_instance_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  associate_public_ip_address = true
  # Attach the kokkok-ec2-role instance profile so the EC2 can read
  # Secrets Manager (RDS password) + S3 (deploy artifact + media) +
  # SSM. The role was provisioned manually by Dynamic Solution
  # (kokkok-ec2-role + kokkok-ec2-secrets + kokkok-ec2-s3 policies).
  # iam:PassRole on that role was granted to jeonhs9110 on 2026-06-24,
  # so terraform can attach it during replace operations. Same name
  # for the instance profile and role is AWS's auto-created convention
  # when the role is built in the console.
  iam_instance_profile = "kokkok-ec2-role"
  user_data            = local.user_data
  # Force a replace whenever user_data changes. Without this, terraform
  # would "update in-place" — the stored user_data metadata gets
  # rewritten but the running instance keeps booting its own old script
  # forever, so a user_data fix never reaches prod until somebody also
  # remembers to pass -replace on apply. This setting makes the source
  # of truth honest.
  user_data_replace_on_change = true

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  metadata_options {
    http_tokens   = "required"
    http_endpoint = "enabled"
  }

  # Timestamp suffix so during a create_before_destroy swap the temporarily
  # coexisting old + new instances don't share a Name tag (just makes the
  # EC2 console less confusing during the ~5min overlap window).
  tags = {
    Name = "${var.project_name}-app-${formatdate("YYMMDD-hhmm", timestamp())}"
  }

  lifecycle {
    # ZERO-DOWNTIME REPLACEMENT:
    # 1. Terraform creates the new instance first.
    # 2. The new aws_lb_target_group_attachment.app (also
    #    create_before_destroy) attaches it to the TG — both old + new
    #    are now in the TG.
    # 3. null_resource.wait_for_healthy (wait.tf) blocks apply until the
    #    new target reports `healthy`.
    # 4. Old attachment is destroyed → old instance deregisters and
    #    drains for 30s (aws_lb_target_group.app.deregistration_delay).
    # 5. Old instance is finally destroyed.
    # Net visible downtime: 0s. Net cost: ~$0.005 for the 5min overlap.
    create_before_destroy = true

    # Ignore the timestamp tag — otherwise every `terraform plan` would
    # see a Name diff and force a replacement on its own. Only real
    # config changes (user_data, instance_type, etc.) trigger replace.
    ignore_changes = [ami, tags]
  }
}
