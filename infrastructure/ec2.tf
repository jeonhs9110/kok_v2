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

# Phase 1 deploy: no IAM instance profile (waiting on account admin to create
# kokkok-ec2-role). EC2 clones the public GitHub repo and runs `next start`
# directly — no ECR pull, no Secrets Manager, no S3 access required.
# Env vars come from terraform variables, written into a systemd EnvironmentFile.
locals {
  # Hybrid Phase 2 user-data:
  #   1. Try to fetch a pre-built artifact from S3 (Phase 2A, fast path, ~90s)
  #   2. Fall back to git clone + npm ci + build (Phase 1.5, slow path, ~5min)
  #
  # This lets the deploy pipeline progress safely: if GitHub Actions has
  # ever produced an artifact, EC2 takes the fast path; if not (or if the
  # artifact 404s for any reason), the legacy path keeps the site alive.
  # Once the workflow is proven, we'll delete the fallback in a follow-up
  # to slim the user-data and shave another ~20s of AMI-install time off.

  artifact_url = aws_s3_bucket.deploy_artifacts.bucket != "" ? "https://${aws_s3_bucket.deploy_artifacts.bucket}.s3.${var.region}.amazonaws.com/latest.tar.gz" : ""

  user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    exec > >(tee -a /var/log/kokkok-boot.log) 2>&1

    # ---- env file (needed by BOTH paths) ----
    install -d -m 750 -o ec2-user -g ec2-user /etc/kokkok
    cat >/etc/kokkok/env <<'ENVEOF'
    NODE_ENV=production
    PORT=3000
    HOSTNAME=0.0.0.0
    NEXT_TELEMETRY_DISABLED=1
    NEXT_PUBLIC_SUPABASE_URL=${var.next_public_supabase_url}
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${var.next_public_supabase_anon_key}
    OPENAI_API_KEY=${var.openai_api_key}
    ANALYTICS_IP_SALT=${var.analytics_ip_salt}
    USE_RDS=${var.use_rds}
    ENVEOF

    # ---- RDS cutover: fetch DATABASE_URL when use_rds=true ----
    # When the cutover toggle is flipped, the EC2 role
    # (kokkok-ec2-role + kokkok-ec2-secrets policy) lets us retrieve the
    # RDS password from Secrets Manager at boot. The JSON shape stored in
    # the secret is {"username": "...", "password": "..."} so jq the
    # password field, then assemble the DATABASE_URL with sslmode=require
    # (TLS is on by default on RDS Postgres 16). The dispatcher in
    # src/lib/db/pool.ts checks USE_RDS === "true" AND a present
    # DATABASE_URL — both must land for the cutover to take effect.
    if [ "${var.use_rds}" = "true" ]; then
      dnf install -y --setopt=install_weak_deps=False jq awscli2 || true
      RDS_PW=$(aws secretsmanager get-secret-value \
        --secret-id ${aws_secretsmanager_secret.rds_master_password.name} \
        --region ${var.region} \
        --query SecretString --output text | jq -r .password)
      echo "DATABASE_URL=postgresql://${var.db_username}:$RDS_PW@${aws_db_instance.main.endpoint}/${var.db_name}?sslmode=require" >> /etc/kokkok/env
    fi

    chmod 640 /etc/kokkok/env
    chown root:ec2-user /etc/kokkok/env

    # ---- always need Node.js runtime ----
    dnf install -y --setopt=install_weak_deps=False tar gzip
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    dnf install -y --setopt=install_weak_deps=False nodejs

    install -d -o ec2-user -g ec2-user /opt/kokkok/app

    # ---- try Phase 2A (fast): download pre-built artifact ----
    ARTIFACT_URL="${local.artifact_url}"
    EXEC_START=""
    if [ -n "$ARTIFACT_URL" ] && curl -fsSL "$ARTIFACT_URL" -o /tmp/app.tar.gz; then
      echo "[boot] Phase 2A — using pre-built artifact from $ARTIFACT_URL"
      tar -xzf /tmp/app.tar.gz -C /opt/kokkok/app
      chown -R ec2-user:ec2-user /opt/kokkok/app
      rm -f /tmp/app.tar.gz
      # Next.js standalone produces a top-level server.js entrypoint.
      EXEC_START="/usr/bin/node server.js"
    else
      # ---- Phase 1.5 fallback (slow): clone + npm ci + npm build ----
      echo "[boot] Phase 1.5 fallback — artifact unavailable, building from source"
      dnf install -y --setopt=install_weak_deps=False git
      sudo -u ec2-user git clone --depth 1 --single-branch --branch master \
        https://github.com/jeonhs9110/kok_v2.git /opt/kokkok/app-src
      # Move into app dir to keep the standalone vs source path structure
      # consistent for systemd's WorkingDirectory.
      cp -a /opt/kokkok/app-src/. /opt/kokkok/app/
      rm -rf /opt/kokkok/app-src
      chown -R ec2-user:ec2-user /opt/kokkok/app
      # Sharp's postinstall picks the right platform binary; without it,
      # next/image silently falls back to the WASM resizer and burns CPU.
      sudo -u ec2-user bash -c '\
        cd /opt/kokkok/app && \
        npm ci --prefer-offline --no-audit --no-fund'
      sudo -u ec2-user bash -c '\
        set -a; source /etc/kokkok/env; set +a; \
        cd /opt/kokkok/app && \
        npm run build'
      EXEC_START="/usr/bin/npm start"
    fi

    # ---- systemd unit (ExecStart depends on which path took us here) ----
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
    ExecStart=$EXEC_START
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
  # Secrets Manager (RDS password fetch in user_data) + ECR (future
  # docker image pulls) + S3 + SSM. The role was provisioned manually
  # by Dynamic Solution (kokkok-ec2-role + kokkok-ec2-secrets +
  # kokkok-ec2-s3 policies). iam:PassRole on that role was granted to
  # jeonhs9110 on 2026-06-24, so terraform can now attach it during
  # replace operations — previously this line was a comment because
  # the IAM grant was pending. Same name for the instance profile and
  # role is the AWS auto-created convention when the role is built in
  # the console.
  iam_instance_profile = "kokkok-ec2-role"
  user_data            = local.user_data

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
