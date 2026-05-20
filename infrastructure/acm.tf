resource "aws_acm_certificate" "main" {
  domain_name               = "kokkokgarden.com"
  subject_alternative_names = ["www.kokkokgarden.com"]
  validation_method         = "DNS"

  lifecycle {
    create_before_destroy = true
  }

  tags = { Name = "${var.project_name}-cert" }
}

output "acm_certificate_arn" {
  value = aws_acm_certificate.main.arn
}

output "acm_validation_records" {
  description = "Add these CNAME records to Yesnic DNS to validate the certificate"
  value = [
    for dvo in aws_acm_certificate.main.domain_validation_options : {
      domain = dvo.domain_name
      name   = dvo.resource_record_name
      value  = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  ]
}
