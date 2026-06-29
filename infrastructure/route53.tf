# Route 53 hosted zone for kokkokgarden.com
#
# 2026-06-30: prepared for the Vercel cutoff. The apex A record has
# been upgraded from "Vercel IPs" to "ALIAS → CloudFront" so bare
# kokkokgarden.com survives the moment Vercel is canceled. SES
# verification + DKIM + SPF + DMARC records also added here so DNS
# stays inside AWS and the operator never touches Vercel again.
#
# The flip-the-switch step is OUT of terraform's hands: at the domain
# registrar (Yesnic), change the kokkokgarden.com nameservers from
# Vercel's to the four AWS values in the route53_nameservers output.
# Until that happens, Vercel keeps serving DNS to the world.
#
# Records this zone owns:
#   - apex A ALIAS → CloudFront                 (storefront — survives Vercel cancel)
#   - www CNAME → CloudFront DNS                (legacy compat)
#   - MX → 10 mx3.daouoffice.com                (Daouoffice email)
#   - TXT (apex SPF) → preserves Daouoffice mailflow
#   - TXT (_amazonses) → SES domain ownership proof
#   - 3× CNAME (_domainkey) → SES DKIM signing keys
#   - TXT (mail. SPF) → SES bounce subdomain authorization
#   - MX (mail.) → SES bounce return path
#   - TXT (_dmarc) → policy=none (monitor mode)
#
# Cost: $0.50/mo per hosted zone + ~$0.40 per million queries. Well
# within the $70/mo budget cap; replaces whatever Vercel was charging
# for DNS once the nameservers flip.

resource "aws_route53_zone" "main" {
  name    = "kokkokgarden.com"
  comment = "Authoritative once nameservers flip at Yesnic from Vercel to the four NS values output below."

  tags = {
    Name        = "kokkokgarden.com"
    Environment = "prod"
    Project     = "kokkok-garden"
    Status      = "ready-for-cutover"
  }
}

# Apex A ALIAS → CloudFront. AWS resolves this to the CloudFront edge
# IPs at lookup time, so bare kokkokgarden.com always serves the same
# distribution as www. Without ALIAS we'd need static A records, which
# can't track CloudFront's IPs as they change.
resource "aws_route53_record" "apex_a" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "kokkokgarden.com"
  type    = "A"
  alias {
    name                   = aws_cloudfront_distribution.main.domain_name
    zone_id                = aws_cloudfront_distribution.main.hosted_zone_id
    evaluate_target_health = false
  }
}

# www → CloudFront. CNAME works here because www isn't the zone apex;
# both kokkokgarden.com and www.kokkokgarden.com are in the
# CloudFront distribution's aliases list (see cloudfront.tf).
resource "aws_route53_record" "www_cname" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.kokkokgarden.com"
  type    = "CNAME"
  ttl     = 300
  records = [aws_cloudfront_distribution.main.domain_name]
}

# Email (Daouoffice / 다오 그룹웨어) — preserves any contact@... mailbox.
resource "aws_route53_record" "apex_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "kokkokgarden.com"
  type    = "MX"
  ttl     = 3600
  records = ["10 mx3.daouoffice.com"]
}

# SPF — emails sent from these IPs are authorized. If this record is
# missed during the cutover, outbound mail from contact@kokkokgarden.com
# starts getting marked as spam by Gmail/Naver.
resource "aws_route53_record" "apex_spf" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "kokkokgarden.com"
  type    = "TXT"
  ttl     = 3600
  records = [
    "v=spf1 ip4:34.22.91.177 include:_vpc.daouoffice.com ip4:35.216.30.162 ip4:35.216.88.227 ~all"
  ]
}

# ─────────────────────────────────────────────────────────────────────
# SES records (formerly the operator's "add at Vercel" homework list,
# now native here so no manual DNS work is needed post-Vercel-cutoff).
# ─────────────────────────────────────────────────────────────────────

# SES domain ownership proof — TXT at _amazonses.<domain>.
resource "aws_route53_record" "ses_verification" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_amazonses.kokkokgarden.com"
  type    = "TXT"
  ttl     = 1800
  records = [aws_ses_domain_identity.kokkokgarden.verification_token]
}

# DKIM signing keys — one CNAME per token. for_each over the 3 tokens
# so a future SES re-key (rotates tokens) replaces all three cleanly.
resource "aws_route53_record" "ses_dkim" {
  for_each = toset(aws_ses_domain_dkim.kokkokgarden.dkim_tokens)
  zone_id  = aws_route53_zone.main.zone_id
  name     = "${each.value}._domainkey.kokkokgarden.com"
  type     = "CNAME"
  ttl      = 1800
  records  = ["${each.value}.dkim.amazonses.com"]
}

# Mail-from subdomain SPF — authorizes SES IPs to send From: addresses
# under mail.kokkokgarden.com (the bounce return path).
resource "aws_route53_record" "ses_mail_spf" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "mail.kokkokgarden.com"
  type    = "TXT"
  ttl     = 1800
  records = ["v=spf1 include:amazonses.com ~all"]
}

# Mail-from subdomain MX — SES uses this to receive bounce/complaint
# return-path messages. ap-northeast-2 region pinned to match the SES
# identity.
resource "aws_route53_record" "ses_mail_mx" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "mail.kokkokgarden.com"
  type    = "MX"
  ttl     = 1800
  records = ["10 feedback-smtp.${var.region}.amazonses.com"]
}

# DMARC — p=none is monitor mode. The `rua=` aggregated-report clause
# was dropped because the operator chose not to provision an inbox
# under the domain. The policy still works without rua — receiving
# providers (Gmail/Outlook) consult the DKIM/SPF alignment rules
# without needing to report back to anyone. We lose visibility into
# attempted spoofing, but the protection is intact. To re-enable
# reporting later, add `; rua=mailto:<real-mailbox>@kokkokgarden.com`
# to the record value.
resource "aws_route53_record" "ses_dmarc" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "_dmarc.kokkokgarden.com"
  type    = "TXT"
  ttl     = 1800
  records = ["v=DMARC1; p=none; pct=100; aspf=r; adkim=r"]
}

# Output the NS values for the operator to set at Yesnic (the domain
# registrar). This is THE one cutover step that can't be automated —
# the registrar's API isn't part of AWS. Until the operator does this,
# Vercel keeps serving DNS to the world.
output "route53_nameservers" {
  value       = aws_route53_zone.main.name_servers
  description = "AWS Route 53 nameservers for kokkokgarden.com. To cut Vercel off entirely: log into Yesnic, replace the current Vercel nameservers with these four values, save. Propagation 24-48h. After that, Vercel can be canceled without affecting the site, mailflow, or SES."
}

output "route53_zone_id" {
  value       = aws_route53_zone.main.zone_id
  description = "Route 53 hosted zone ID — referenced by any future ACM cert validation records, subdomain delegation, etc."
}
