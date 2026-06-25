# Route 53 "shadow zone" for kokkokgarden.com
#
# IMPORTANT: this is a SHADOW zone. We create it in AWS, populate it
# with the same records currently live in Vercel, BUT we DO NOT change
# the registrar's nameservers. So:
#
#   Yesnic (registrar)
#     └─ nameservers point to Vercel  ← stays untouched (live DNS)
#          └─ Vercel serves DNS traffic the world sees
#
#   AWS Route 53 (this resource)        ← we build this
#     └─ has the same records, ready to serve
#     └─ has its own NS records, but NOBODY POINTS AT THEM YET
#
# Cost: $0.50/mo per hosted zone + ~$0.40 per million queries (queries
# stay at $0 until nameservers flip). Well within budget.
#
# Handoff plan: when Dynamic Solution is ready to take over DNS, the
# only change is "update kokkokgarden.com nameservers at Yesnic to the
# NS values from this Route 53 zone" (output below). Propagation takes
# 24-48 hours but the records resolve identically because we mirrored
# them. No prod risk to the live site once the apex/www records are
# verified correct here.
#
# Records mirrored from current Vercel-hosted DNS (probed 2026-06-24):
#   - apex A → 64.29.17.1, 64.29.17.65          (Vercel IPs, legacy)
#   - www CNAME → d2j7yfbvcyb3f7.cloudfront.net (our CloudFront)
#   - MX → 10 mx3.daouoffice.com                (Daouoffice email)
#   - TXT (SPF) → "v=spf1 ip4:34.22.91.177 …"   (email auth)
#
# Note: when Dynamic Solution actually cuts over, they should also
# upgrade the apex from "A → Vercel IPs" (which will go dark when
# Vercel is canceled) to "A ALIAS → CloudFront" — a 5-min change that
# lets bare kokkokgarden.com serve the storefront too. For now we
# preserve the existing setup so the shadow zone is a faithful copy.

resource "aws_route53_zone" "main" {
  name    = "kokkokgarden.com"
  comment = "Shadow zone — populated 2026-06-24, NOT YET LIVE. Switch nameservers at Yesnic to activate. Vercel is currently authoritative."

  tags = {
    Name        = "kokkokgarden.com"
    Environment = "prod"
    Project     = "kokkok-garden"
    Status      = "shadow"
  }
}

# Apex A records — mirror of Vercel's legacy IPs. Dynamic Solution
# should change these to an ALIAS pointing at CloudFront before
# canceling Vercel, otherwise bare kokkokgarden.com goes dark.
resource "aws_route53_record" "apex_a" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "kokkokgarden.com"
  type    = "A"
  ttl     = 300
  records = ["64.29.17.1", "64.29.17.65"]
}

# www CNAME → CloudFront distribution (already serving live traffic
# at this address via Vercel's CNAME today; mirror unchanged here so
# the failover is seamless).
resource "aws_route53_record" "www_cname" {
  zone_id = aws_route53_zone.main.zone_id
  name    = "www.kokkokgarden.com"
  type    = "CNAME"
  ttl     = 300
  records = ["d2j7yfbvcyb3f7.cloudfront.net"]
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

# Output the NS values that need to land at Yesnic when Dynamic
# Solution actually wants to flip authoritative DNS. Until they do,
# this output is just informational.
output "route53_nameservers" {
  value       = aws_route53_zone.main.name_servers
  description = "AWS Route 53 nameservers for kokkokgarden.com. Currently unused — when Dynamic Solution is ready to cut over from Vercel, update the nameservers at Yesnic to these four values. Until then, the zone is a dormant mirror."
}

output "route53_zone_id" {
  value       = aws_route53_zone.main.zone_id
  description = "Route 53 hosted zone ID — referenced by any future ACM cert validation records, subdomain delegation, etc."
}
