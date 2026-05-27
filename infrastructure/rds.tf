resource "random_password" "db_password" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_secretsmanager_secret" "db_password" {
  name        = "${var.project_name}/db/password-${random_id.suffix.hex}"
  description = "RDS master password for ${var.project_name}"
  recovery_window_in_days = 0
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_db_instance" "main" {
  identifier              = "${var.project_name}-db"
  engine                  = "postgres"
  engine_version          = "16.6"
  instance_class          = var.db_instance_class
  allocated_storage       = var.db_allocated_storage_gb
  # Storage autoscaling disabled on Free Tier; enable after account upgrade.
  # max_allocated_storage = var.db_max_allocated_storage_gb
  storage_type            = "gp2"
  storage_encrypted       = false # Free Tier blocks KMS encryption — enable post-upgrade

  db_name                 = var.db_name
  username                = var.db_username
  password                = random_password.db_password.result

  db_subnet_group_name    = aws_db_subnet_group.main.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  publicly_accessible     = false
  multi_az                = false

  # Free Tier accounts cap automated backups at 1 day. Raise once account
  # is upgraded (payment method added by 콕콕가든).
  backup_retention_period = 1
  backup_window           = "17:00-18:00"
  maintenance_window      = "Mon:18:00-Mon:19:00"

  performance_insights_enabled = false
  monitoring_interval          = 0
  auto_minor_version_upgrade   = true
  apply_immediately            = false
  deletion_protection          = true
  skip_final_snapshot          = false
  final_snapshot_identifier    = "${var.project_name}-db-final-${random_id.suffix.hex}"

  tags = { Name = "${var.project_name}-db" }
}
