data "aws_ami" "al2023_arm" {
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

# User data: install Docker, log in to ECR, pull image, run on :3000
locals {
  user_data = <<-EOT
    #!/bin/bash
    set -euxo pipefail
    dnf update -y
    dnf install -y docker awscli
    systemctl enable --now docker
    usermod -a -G docker ec2-user

    # SSM agent is preinstalled on AL2023; just ensure it's running
    systemctl enable --now amazon-ssm-agent || true

    # Convenience: drop a small helper that pulls latest from ECR and restarts
    cat >/usr/local/bin/kokkok-deploy <<'EOF'
    #!/bin/bash
    set -euxo pipefail
    REGION=${var.region}
    ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text --region "$REGION")
    REPO="${aws_ecr_repository.app.repository_url}"
    aws ecr get-login-password --region "$REGION" | docker login --username AWS --password-stdin "$REPO"
    docker pull "$REPO:latest"
    docker rm -f kokkok || true
    docker run -d --name kokkok --restart unless-stopped \
      -p 3000:3000 \
      -e NODE_ENV=production \
      "$REPO:latest"
    EOF
    chmod +x /usr/local/bin/kokkok-deploy

    # First boot: the image hasn't been pushed yet. Skip the pull and let
    # the deploy GitHub Action / Bitbucket Pipeline kick the helper later.
  EOT
}

resource "aws_instance" "app" {
  ami                         = data.aws_ami.al2023_arm.id
  instance_type               = var.ec2_instance_type
  subnet_id                   = aws_subnet.public[0].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  associate_public_ip_address = true
  user_data                   = local.user_data

  root_block_device {
    volume_type = "gp3"
    volume_size = 20
    encrypted   = true
  }

  metadata_options {
    http_tokens   = "required" # IMDSv2 only
    http_endpoint = "enabled"
  }

  tags = { Name = "${var.project_name}-app" }

  lifecycle {
    ignore_changes = [ami] # don't replace instance just because a new AL2023 came out
  }
}
