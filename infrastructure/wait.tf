# Blocks `terraform apply` until the NEW aws_instance.app reports
# `healthy` in the ALB target group. Because both aws_instance.app and
# aws_lb_target_group_attachment.app are create_before_destroy, and this
# null_resource transitively depends on the new instance ID, Terraform
# sequences as:
#
#   1. Create new EC2 (boot + npm ci + build, ~5min)
#   2. Create new TG attachment (old still attached too)
#   3. RUN THIS PROVISIONER — `aws elbv2 wait target-in-service`
#      blocks until the new instance is healthy (~20-30s after the app
#      actually starts responding)
#   4. Destroy old TG attachment → old instance starts draining
#      (deregistration_delay = 30s)
#   5. Destroy old EC2
#
# Visible downtime: 0s. The TG always has at least one healthy target.

resource "null_resource" "wait_for_healthy" {
  triggers = {
    # Re-runs the wait every time the instance is replaced.
    instance_id = aws_instance.app.id
  }

  provisioner "local-exec" {
    # No `interpreter` block — let Terraform pick the OS default (cmd.exe on
    # Windows, sh on Linux). Earlier this used `bash -c` which broke when the
    # operator ran from PowerShell without Git Bash on PATH, killing the apply
    # mid-flight and leaving both old and new instances attached to the ALB.
    # The aws CLI returns non-zero on `wait` failure, which local-exec
    # surfaces as a provisioner error — no shell guard needed.
    environment = {
      AWS_PROFILE = var.aws_profile
      AWS_REGION  = var.region
    }
    command = "aws elbv2 wait target-in-service --target-group-arn ${aws_lb_target_group.app.arn} --targets Id=${aws_instance.app.id},Port=3000"
  }

  depends_on = [aws_lb_target_group_attachment.app]

  lifecycle {
    create_before_destroy = true
  }
}
