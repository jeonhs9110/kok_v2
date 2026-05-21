resource "aws_acm_certificate" "main" {
  # Wildcard covers www.kokkokgarden.com (and any future subdomain). Avoids
  # CAA chain issue: with "www.kokkokgarden.com" as SAN, ACM followed the
  # www→vercel-dns-017 CNAME and CAA-checked Vercel's domain (where Amazon
  # is not authorized). With a wildcard, ACM CAA-checks only at the
  # kokkokgarden.com apex (where amazontrust.com IS authorized). Apex
  # (kokkokgarden.com) intentionally NOT in cert — it stays on Vercel
  # serving the redirect to www.
  domain_name               = "*.kokkokgarden.com"
  subject_alternative_names = []
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
