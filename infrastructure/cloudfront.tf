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
  cf_caching_optimized    = "658327ea-f89d-4fab-a63d-7e88639e58f6" # 1d default, 1y max, respects origin
  cf_caching_disabled     = "4135ea2d-6df8-44a3-9df3-4b5a84be39ad" # no cache (HTML / API)
  cf_origin_req_allviewer = "216adef6-5c7f-47e4-b989-5492eafa07d3" # forward all headers/cookies/qs
  cf_origin_req_static    = "59781a5b-3903-41f3-afcb-af62929ccde1" # CORS-S3Origin: forward minimal
}

# Custom cache policy for /_next/image* — Next.js's image optimizer
# returns AVIF / WebP / original based on the viewer's Accept header,
# but the managed CachingOptimized policy doesn't include Accept in
# the cache key. Result before fix: whichever format hit the edge
# first got cached and served to every other viewer — browsers that
# don't accept that format saw a broken image (Edge sometimes; older
# Safari always). This policy keys on url+w+q query strings AND the
# Accept header so each variant caches independently.
resource "aws_cloudfront_cache_policy" "next_image" {
  name        = "${var.project_name}-next-image"
  comment     = "Cache /_next/image responses per Accept header so AVIF/WebP variants don't collide"
  default_ttl = 86400    # 1 day
  max_ttl     = 31536000 # 1 year (respects origin Cache-Control if shorter)
  min_ttl     = 0

  parameters_in_cache_key_and_forwarded_to_origin {
    enable_accept_encoding_brotli = true
    enable_accept_encoding_gzip   = true

    headers_config {
      header_behavior = "whitelist"
      headers {
        items = ["Accept"]
      }
    }
    cookies_config {
      cookie_behavior = "none"
    }
    query_strings_config {
      query_string_behavior = "all"
    }
  }
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

  # Second origin: the media bucket. Receives only requests matched by
  # the /media/* behavior below. OAC signs the request so the bucket
  # policy can authenticate it as coming from this distribution.
  origin {
    domain_name              = aws_s3_bucket.media.bucket_regional_domain_name
    origin_id                = "media-origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.media.id
  }

  # Default behavior — HTML pages, API routes, anything not matched
  # below. No edge cache (we let the origin set Cache-Control). All
  # headers/cookies/query strings forwarded so SSR works correctly.
  default_cache_behavior {
    allowed_methods          = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods           = ["GET", "HEAD"]
    target_origin_id         = "alb-origin"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = local.cf_caching_disabled
    origin_request_policy_id = local.cf_origin_req_allviewer
  }

  # Next.js hashed static chunks — immutable, 1-year cache. The biggest
  # cache hit-rate win since every customer touches the same chunks.
  ordered_cache_behavior {
    path_pattern             = "/_next/static/*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD", "OPTIONS"]
    target_origin_id         = "alb-origin"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = local.cf_caching_optimized
    origin_request_policy_id = local.cf_origin_req_static
  }

  # /media/* — user-uploaded images and videos served from S3.
  # Declared BEFORE the *.svg behavior so that /media/...svg requests
  # hit S3 instead of falling through to the ALB origin (CloudFront
  # evaluates ordered_cache_behavior blocks in declaration order).
  # CloudFront strips the leading /media/ before forwarding to S3, so a
  # request for /media/product-images/foo.jpg fetches the key
  # product-images/foo.jpg from the bucket. Cache forever — uploads use
  # content-derived filenames (matching the Supabase pattern) so a given
  # URL's bytes never change. Public reads only — uploads bypass
  # CloudFront entirely and go presigned-PUT direct to S3.
  ordered_cache_behavior {
    path_pattern             = "/media/*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD", "OPTIONS"]
    target_origin_id         = "media-origin"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = local.cf_caching_optimized
    origin_request_policy_id = local.cf_origin_req_static

    function_association {
      event_type   = "viewer-request"
      function_arn = aws_cloudfront_function.media_strip_prefix.arn
    }
  }

  # /public/* static assets — SVG logo, font files, robots.txt, etc.
  # next.config.ts headers() set max-age=604800 on these; CloudFront
  # respects origin Cache-Control with the Optimized policy.
  ordered_cache_behavior {
    path_pattern             = "/fonts/*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD", "OPTIONS"]
    target_origin_id         = "alb-origin"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = local.cf_caching_optimized
    origin_request_policy_id = local.cf_origin_req_static
  }

  ordered_cache_behavior {
    path_pattern             = "*.svg"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD", "OPTIONS"]
    target_origin_id         = "alb-origin"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = local.cf_caching_optimized
    origin_request_policy_id = local.cf_origin_req_static
  }

  # next/image's optimizer serves under /_next/image. Needs two custom
  # bits the managed policies don't cover:
  #   1. Origin must receive the `url=`, `w=`, `q=` query strings —
  #      cf_origin_req_static (CORS-S3Origin) strips them, producing
  #      a 400 from Next.js for "missing url parameter".
  #   2. Cache key must include the Accept header so AVIF/WebP/source
  #      variants cache independently per viewer-capability.
  ordered_cache_behavior {
    path_pattern             = "/_next/image*"
    allowed_methods          = ["GET", "HEAD", "OPTIONS"]
    cached_methods           = ["GET", "HEAD", "OPTIONS"]
    target_origin_id         = "alb-origin"
    viewer_protocol_policy   = "redirect-to-https"
    compress                 = true
    cache_policy_id          = aws_cloudfront_cache_policy.next_image.id
    origin_request_policy_id = local.cf_origin_req_allviewer
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

# Tiny edge function — rewrites /media/<key> to /<key> before forwarding
# to the S3 origin. Keeps the public URL scheme tidy (the bucket has its
# own product-images/ and site-assets/ prefixes; we don't want /media/
# baked into every S3 key on top of that).
resource "aws_cloudfront_function" "media_strip_prefix" {
  name    = "${var.project_name}-media-strip-prefix"
  runtime = "cloudfront-js-2.0"
  comment = "Strip /media prefix before S3 origin fetch"
  publish = true
  code    = <<-EOT
    function handler(event) {
      var req = event.request;
      if (req.uri.indexOf('/media/') === 0) {
        req.uri = req.uri.substring(6);
      }
      return req;
    }
  EOT
}

output "cloudfront_domain_name" {
  description = "CloudFront default URL. Hit this from anywhere outside Korea to compare cold-load timing against the direct ALB."
  value       = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  description = "Used by CLI/console for cache invalidation: aws cloudfront create-invalidation --distribution-id <id> --paths '/*'"
  value       = aws_cloudfront_distribution.main.id
}
