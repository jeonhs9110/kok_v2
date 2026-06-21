# ACM certificate for the CloudFront distribution.
#
# CloudFront only accepts certs from us-east-1, regardless of where the
# rest of the infrastructure lives. The existing ALB cert in
# ap-northeast-2 (acm.tf) stays put — this is a separate cert dedicated
# to the edge layer.
#
# Validation is DNS-based. terraform creates the cert in PENDING state
# and emits the validation CNAME records as an output; the operator
# adds those to Vercel DNS (since Vercel hosts kokkokgarden.com's NS).
# After the CNAMEs propagate, AWS marks the cert as ISSUED automatically
# (no second terraform apply needed for that step).
resource "aws_acm_certificate" "cloudfront" {
  provider          = aws.us_east_1
  domain_name       = var.domain_name
  subject_alternative_names = ["www.${var.domain_name}"]
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${var.project_name}-cloudfront-cert" }
}

# Output the validation records the operator needs to copy into Vercel's
# DNS panel. AWS returns one CNAME per domain — both must be added.
# Until both are added + propagated, terraform's downstream
# distribution apply with the custom domain enabled will hang.
output "cloudfront_cert_validation_records" {
  description = "CNAME records to add in Vercel DNS to validate the CloudFront ACM cert (us-east-1). Add BOTH and wait 5–30min for AWS to mark the cert ISSUED."
  value = [
    for opt in aws_acm_certificate.cloudfront.domain_validation_options : {
      domain = opt.domain_name
      name   = opt.resource_record_name
      type   = opt.resource_record_type
      value  = opt.resource_record_value
    }
  ]
}
