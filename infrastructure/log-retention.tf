# CloudWatch log group retention policies.
#
# Without an explicit retention, log groups default to "Never expire"
# and storage cost grows linearly forever. RDS Postgres exports
# (postgresql + upgrade) are the chattiest; alarm-related groups are
# trivial. 30 days covers any realistic incident-response window —
# longer-term forensics belong in S3 (audit_logs bucket) rather than
# CloudWatch.
#
# `aws_cloudwatch_log_group` resources here are imported, not created:
# RDS creates the groups itself when `enabled_cloudwatch_logs_exports`
# is set. Terraform manages only the retention policy on the existing
# group — a `terraform import` step is needed once for each on first
# apply if the group already exists. After that, `retention_in_days`
# is the only managed attribute.

resource "aws_cloudwatch_log_group" "rds_postgresql" {
  name              = "/aws/rds/instance/${aws_db_instance.main.id}/postgresql"
  retention_in_days = 30
  tags              = { Name = "${var.project_name}-rds-postgresql-log" }

  # RDS creates the log group automatically when the export is
  # enabled. If terraform tries to recreate it the apply fails with
  # "AlreadyExists". Lifecycle ignore_changes + import resolves it.
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_cloudwatch_log_group" "rds_upgrade" {
  name              = "/aws/rds/instance/${aws_db_instance.main.id}/upgrade"
  retention_in_days = 30
  tags              = { Name = "${var.project_name}-rds-upgrade-log" }

  lifecycle {
    prevent_destroy = true
  }
}
