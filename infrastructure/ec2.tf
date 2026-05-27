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
  user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    exec > >(tee -a /var/log/kokkok-boot.log) 2>&1

    # ---- system deps ----
    # Skip `dnf update -y` — AL2023 base image is fresh enough; the update
    # was costing ~30s of cold-cache time on every boot.
    # `--setopt=install_weak_deps=False` skips Recommends, ~5s saving.
    dnf install -y --setopt=install_weak_deps=False git tar gzip
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    dnf install -y --setopt=install_weak_deps=False nodejs

    # ---- clone app ----
    # --single-branch avoids fetching refs we won't use.
    install -d -o ec2-user -g ec2-user /opt/kokkok
    sudo -u ec2-user git clone --depth 1 --single-branch --branch master \
      https://github.com/jeonhs9110/kok_v2.git /opt/kokkok/app
    cd /opt/kokkok/app

    # ---- env file ----
    install -d -m 750 -o ec2-user -g ec2-user /etc/kokkok
    cat >/etc/kokkok/env <<'ENVEOF'
    NODE_ENV=production
    PORT=3000
    HOSTNAME=0.0.0.0
    NEXT_TELEMETRY_DISABLED=1
    NEXT_PUBLIC_SUPABASE_URL=${var.next_public_supabase_url}
    NEXT_PUBLIC_SUPABASE_ANON_KEY=${var.next_public_supabase_anon_key}
    OPENAI_API_KEY=${var.openai_api_key}
    ENVEOF
    chmod 640 /etc/kokkok/env
    chown root:ec2-user /etc/kokkok/env

    # ---- install + build (as ec2-user so files are owned correctly) ----
    # IMPORTANT: source /etc/kokkok/env BEFORE `npm run build` so that
    # NEXT_PUBLIC_* vars get inlined into the client bundle. Without this,
    # the client-side supabase client is null and any browser-side fetch
    # (e.g. Header nav menus) returns nothing.
    # --prefer-offline uses the npm cache first, --no-audit/--no-fund skip
    # the audit + funding API calls (each ~5-10s on slow networks),
    # --ignore-scripts skips package postinstall hooks (none needed here).
    sudo -u ec2-user bash -c '\
      cd /opt/kokkok/app && \
      npm ci --prefer-offline --no-audit --no-fund --ignore-scripts'
    sudo -u ec2-user bash -c '\
      set -a; source /etc/kokkok/env; set +a; \
      cd /opt/kokkok/app && \
      npm run build'

    # ---- systemd unit ----
    cat >/etc/systemd/system/kokkok.service <<'UNITEOF'
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
    ExecStart=/usr/bin/npm start
    Restart=always
    RestartSec=5
    LimitNOFILE=65536

    [Install]
    WantedBy=multi-user.target
    UNITEOF

    systemctl daemon-reload
    systemctl enable --now kokkok.service

    # ---- mark boot complete ----
    date > /var/log/kokkok-ready
  EOT
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.al2023.id
  instance_type               = var.ec2_instance_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  associate_public_ip_address = true
  # iam_instance_profile attached manually by Dynamic Solution (jeonhs9110 lacks iam:PassRole)
  user_data                   = local.user_data

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
