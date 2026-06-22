# RDS PostgreSQL — Phase 2A of the AWS migration (replaces Supabase Postgres).
#
# Stays single-AZ on db.t4g.micro to keep monthly cost under ~$17. Two
# private subnets are still required (AWS demands at least 2 AZs for
# the subnet group even on single-AZ deploys — see vpc.tf).
#
# Why Postgres 16:
#   Supabase ships Postgres 15+ extensions (uuid-ossp, pgcrypto, etc.)
#   that the schema dump expects. Postgres 16 is the closest current AWS
#   default that supports all of them. Engine upgrades to 17 will be a
#   future minor maintenance window — no schema changes required.
#
# Network posture:
#   - publicly_accessible = false. Only the EC2 instance reaches RDS,
#     through the rds_ingress security group below (5432 from ec2-sg).
#   - No internet egress needed (RDS doesn't initiate outbound).
#   - SSL/TLS enforced via parameter group (rds.force_ssl = 1).
#
# Backups:
#   7-day retention. Free under the t4g.micro tier (backup ≤ DB size).
#   Manual snapshots can be triggered before risky migrations.

resource "aws_db_subnet_group" "main" {
  name        = "${var.project_name}-db-subnet"
  description = "RDS subnet group spanning the two private subnets"
  subnet_ids  = aws_subnet.private[*].id
  tags        = { Name = "${var.project_name}-db-subnet" }
}

resource "aws_security_group" "rds" {
  name        = "${var.project_name}-rds-sg"
  description = "Postgres 5432 ingress from EC2 only"
  vpc_id      = aws_vpc.main.id

  # Only the EC2 app server reaches RDS. No bastion, no direct admin
  # tools — psql access goes through SSM session manager once PassRole
  # lands; until then via the migration utility script that runs from
  # EC2 itself.
  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
    description     = "Postgres from EC2 app server"
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project_name}-rds-sg" }
}

# Force SSL on the wire. The default Postgres param group permits
# unencrypted connections; flipping rds.force_ssl rejects them
# entirely. Application Postgres clients (node-postgres / Prisma)
# need `?sslmode=require` in the connection string.
resource "aws_db_parameter_group" "main" {
  name        = "${var.project_name}-pg16"
  family      = "postgres16"
  description = "Force SSL, tuned for t4g.micro"

  parameter {
    name  = "rds.force_ssl"
    value = "1"
  }

  # log_statement = 'ddl' captures schema-mutating queries to CloudWatch
  # without bloating logs with every SELECT. Useful for catching
  # accidental migrations during the cutover window.
  parameter {
    name  = "log_statement"
    value = "ddl"
  }

  tags = { Name = "${var.project_name}-pg16" }
}

# Random password generated at apply time. Stored in Secrets Manager so
# EC2 can pull it at boot via the existing kokkok-ec2-secrets policy
# (already permitted on kokkok-ec2-role). Until PassRole lands, the
# user-data falls back to reading it from var.rds_master_password —
# transitional only.
resource "random_password" "rds_master" {
  length  = 32
  special = false # avoid shell-escape headaches in user-data heredoc
}

resource "aws_db_instance" "main" {
  identifier             = "${var.project_name}-postgres"
  engine                 = "postgres"
  engine_version         = "16.4"
  instance_class         = "db.t4g.micro"
  allocated_storage      = var.db_allocated_storage_gb
  max_allocated_storage  = var.db_max_allocated_storage_gb
  storage_type           = "gp3"
  storage_encrypted      = true

  db_name                = var.db_name
  username               = var.db_username
  password               = random_password.rds_master.result
  port                   = 5432

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  publicly_accessible    = false

  parameter_group_name   = aws_db_parameter_group.main.name

  backup_retention_period = 7
  backup_window           = "16:00-17:00" # 01:00-02:00 KST, low-traffic
  maintenance_window      = "Sun:17:00-Sun:18:00"

  # Deletion protection ON in prod. To actually delete: flip to false,
  # apply, then run terraform destroy in a second apply.
  deletion_protection      = true
  skip_final_snapshot      = false
  final_snapshot_identifier = "${var.project_name}-postgres-final-${formatdate("YYYYMMDD", timestamp())}"

  # Performance Insights on the t4g.micro is included in the free tier
  # (7-day retention). Cheap insight into slow queries during the
  # migration window.
  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  # Send postgres + upgrade logs to CloudWatch for the rds.force_ssl
  # rejections + slow-query analysis after cutover.
  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  apply_immediately = false # roll changes in the maintenance window

  tags = { Name = "${var.project_name}-postgres" }

  lifecycle {
    ignore_changes = [
      # final_snapshot_identifier embeds the date; recomputing it on
      # every plan would force a no-op replace. Pin to apply-time value.
      final_snapshot_identifier,
    ]
  }
}

# Stash the master password in Secrets Manager for the EC2 runtime to
# pull at boot. The existing kokkok-ec2-secrets policy (created by
# 권대영 in May) already permits GetSecretValue on the kokkok/db/*
# prefix, so this slots in without IAM changes.
resource "aws_secretsmanager_secret" "rds_master_password" {
  name        = "kokkok/db/password-${random_id.suffix.hex}"
  description = "RDS master password for ${aws_db_instance.main.identifier}. Rotate via `terraform taint random_password.rds_master`."
  tags        = { Name = "${var.project_name}-rds-master-password" }
}

resource "aws_secretsmanager_secret_version" "rds_master_password" {
  secret_id = aws_secretsmanager_secret.rds_master_password.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.rds_master.result
    host     = aws_db_instance.main.address
    port     = aws_db_instance.main.port
    dbname   = var.db_name
  })
}

# ─── Outputs ──────────────────────────────────────────────────────

output "rds_endpoint" {
  description = "RDS connection endpoint. Goes in DATABASE_URL after Phase A2 schema migration."
  value       = aws_db_instance.main.endpoint
}

output "rds_secret_arn" {
  description = "Secrets Manager ARN holding the master credentials. EC2 reads from this at boot once PassRole + Secrets policy are wired."
  value       = aws_secretsmanager_secret.rds_master_password.arn
  sensitive   = true
}

output "rds_connection_string_template" {
  description = "Template for the DATABASE_URL env var. Password is in Secrets Manager — do not hardcode."
  value       = "postgresql://${var.db_username}:<PASSWORD>@${aws_db_instance.main.endpoint}/${var.db_name}?sslmode=require"
  sensitive   = false
}
