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
    dnf update -y
    dnf install -y git tar gzip
    curl -fsSL https://rpm.nodesource.com/setup_22.x | bash -
    dnf install -y nodejs

    # ---- clone app ----
    install -d -o ec2-user -g ec2-user /opt/kokkok
    sudo -u ec2-user git clone --depth 1 https://github.com/jeonhs9110/kok_v2.git /opt/kokkok/app
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
    sudo -u ec2-user bash -c 'cd /opt/kokkok/app && npm ci'
    sudo -u ec2-user bash -c 'cd /opt/kokkok/app && npm run build'

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

  tags = { Name = "${var.project_name}-app" }

  lifecycle {
    ignore_changes = [ami]
  }
}
