# CloudFront distribution in front of the ALB.
#
# Why: the storefront origin is a single t4g.small in ap-northeast-2.
# Every customer outside Korea round-trips to Seoul for every asset —
# the SVG logo, the 2.5MB font file, every product image. CloudFront
# caches static assets at AWS's nearest edge POP (Tokyo, LA, Frankfurt,
# Sydney, etc.), cutting global asset latency from ~200-400ms to
# ~10-30ms.
#
# Architecture:
#
#   browser
#      │
#      ▼ DNS (Vercel returns CloudFront alias)
#   CloudFront edge POP
#      │
#      ├──► /_next/static/*  → edge cache (1 yr, immutable)
#      ├──► /fonts/*, *.svg  → edge cache (1 wk, matches next.config.ts)
#      ├──► /api/*, /        → forward to ALB origin (no edge cache)
#      └──► everything else  → forward, short cache (5min, respects origin)
#
#   ALB → EC2 → Supabase (unchanged)
#
# Cache policy IDs are AWS managed — see
# https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/using-managed-cache-policies.html
locals {
  cf_caching_optimized   = "658327ea-f89d-4fab-a63d-7e88639e58f6" # 1d default, 1y max, respects origin
  cf_caching_disabled    = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # no cache (HTML / API)
  cf_origin_req_allviewer = "216adef6-5c7f-47e4-b989-5492eafa07d3" # forward all headers/cookies/qs
  cf_origin_req_static   = "59781a5b-3903-41f3-afcb-af62929ccde1" # CORS-S3Origin: forward minimal
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = "${var.project_name} storefront + admin edge cache"
  default_root_object = "" # Next.js handles the root; CloudFront shouldn't try /index.html

  # The ALB is the only origin. Edge-to-origin uses HTTP because the
  # ALB cert is *.kokkokgarden.com and CloudFront's SNI to the raw ALB
  # hostname (kokkok-alb-...elb.amazonaws.com) fails the CN match,
  # producing 502s. HTTP between CloudFront and ALB is acceptable —
  # both endpoints are inside the AWS network — and viewer↔CloudFront
  # is still HTTPS. The secret header below tells ALB this request
  # came from CloudFront so its HTTP listener bypasses the normal
  # HTTP→HTTPS redirect.
  origin {
    domain_name = aws_lb.main.dns_name
    origin_id   = "alb-origin"

    custom_origin_config {
      http_port                = 80
      https_port               = 443
      origin_protocol_policy   = "http-only"
      origin_ssl_protocols     = ["TLSv1.2"]
      origin_read_timeout      = 30
      origin_keepalive_timeout = 5
    }

    # Secret header — ALB's port-80 listener has a rule that forwards
    # to the target group ONLY when this exact header is present.
    # Every other port-80 request (random scanners, accidental HTTP
    # viewers) still gets the 301-to-HTTPS redirect, preserving the
    # public TLS-only posture.
    custom_header {
      name  = "X-CloudFront-Auth"
      value = var.cloudfront_origin_secret
    }
  }

  # Default behavior — HTML pages, API routes, anything not matched
  # below. No edge cache (we let the origin set Cache-Control). All
  # headers/cookies/query strings forwarded so SSR works correctly.
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id          = local.cf_caching_disabled
    origin_request_policy_id = local.cf_origin_req_allviewer
  }

  # Next.js hashed static chunks — immutable, 1-year cache. The biggest
  # cache hit-rate win since every customer touches the same chunks.
  ordered_cache_behavior {
    path_pattern           = "/_next/static/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id          = local.cf_caching_optimized
    origin_request_policy_id = local.cf_origin_req_static
  }

  # /public/* static assets — SVG logo, font files, robots.txt, etc.
  # next.config.ts headers() set max-age=604800 on these; CloudFront
  # respects origin Cache-Control with the Optimized policy.
  ordered_cache_behavior {
    path_pattern           = "/fonts/*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id          = local.cf_caching_optimized
    origin_request_policy_id = local.cf_origin_req_static
  }

  ordered_cache_behavior {
    path_pattern           = "*.svg"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id          = local.cf_caching_optimized
    origin_request_policy_id = local.cf_origin_req_static
  }

  # next/image's optimizer serves under /_next/image — CloudFront caches
  # the AVIF/WebP variants based on the accept header. Important: the
  # query string drives the cached variant, so we need the Optimized
  # policy which keys on `url` + `q` + `w`.
  ordered_cache_behavior {
    path_pattern           = "/_next/image*"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    target_origin_id       = "alb-origin"
    viewer_protocol_policy = "redirect-to-https"
    compress               = true
    cache_policy_id          = local.cf_caching_optimized
    origin_request_policy_id = local.cf_origin_req_static
  }

  # Aliases: empty until enable_cloudfront_custom_domain = true. Without
  # an alias the distribution is reachable only via its default
  # d*.cloudfront.net URL — fine for testing edge behavior before the
  # DNS swap.
  aliases = var.enable_cloudfront_custom_domain ? [var.domain_name, "www.${var.domain_name}"] : []

  viewer_certificate {
    # Two-phase: default cert (cloudfront.net only) → custom cert
    # once the validation CNAMEs have been added to Vercel and the
    # cert is ISSUED.
    cloudfront_default_certificate = !var.enable_cloudfront_custom_domain
    acm_certificate_arn            = var.enable_cloudfront_custom_domain ? aws_acm_certificate.cloudfront.arn : null
    ssl_support_method             = var.enable_cloudfront_custom_domain ? "sni-only" : null
    minimum_protocol_version       = var.enable_cloudfront_custom_domain ? "TLSv1.2_2021" : null
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  # PriceClass_200 covers North America, Europe, Asia, Middle East,
  # Africa. PriceClass_All adds South America + Oceania for ~30% more
  # cost. Stick with 200 — most KOKKOK traffic is KR + US + JP + CN,
  # all covered.
  price_class = "PriceClass_200"

  # CloudFront's HTTP/2 + HTTP/3 reduces head-of-line blocking for the
  # many small chunks Next.js code-splits the app into.
  http_version = "http2and3"

  tags = { Name = "${var.project_name}-cloudfront" }

  # Distribution deploys take 5-10min. Don't block other terraform work
  # behind it — apply with -target if you need to iterate elsewhere.
  lifecycle {
    create_before_destroy = true
  }
}

output "cloudfront_domain_name" {
  description = "CloudFront default URL. Hit this from anywhere outside Korea to compare cold-load timing against the direct ALB."
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  description = "Used by CLI/console for cache invalidation: aws cloudfront create-invalidation --distribution-id <id> --paths '/*'"
  value       = aws_cloudfront_distribution.main.id
}
