import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

// Baseline security headers applied to every response. Cheap defense
// against the obvious browser-side attack classes (clickjacking, MIME
// sniffing, HTTPS downgrade). HSTS preload list eligibility requires
// max-age >= 1y AND includeSubDomains AND preload — keep all three.
//
// Round 24 adds Content-Security-Policy-Report-Only alongside the
// existing baseline. The Report-Only mode collects violation reports
// at /api/csp-report without actually blocking anything, so the
// handoff engineer can watch CloudWatch for a week of clean traffic
// before flipping to enforcing mode via a one-line PR (change the
// header key from Content-Security-Policy-Report-Only to
// Content-Security-Policy).
//
// The policy allowlist is derived from Round 23's third-party audit +
// Round 24's inline-script inventory (theme tokens style + GA consent
// script + postMessage listeners). `'unsafe-inline'` stays in
// script-src / style-src because Next.js 16 App Router requires it for
// Script components emitted inline; a nonce-based migration is a
// separate PR that needs middleware.ts.
const cspReportOnly = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://use.typekit.net",
  "script-src-attr 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline' https://use.typekit.net https://p.typekit.net https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "style-src-attr 'unsafe-inline'",
  "font-src 'self' https://use.typekit.net https://p.typekit.net https://fonts.gstatic.com https://cdn.jsdelivr.net data:",
  "img-src 'self' data: blob: https://www.kokkokgarden.com https://kokkokgarden.com https://*.supabase.co https://images.unsplash.com https://plus.unsplash.com https://flagcdn.com https://i.ytimg.com",
  "connect-src 'self' https://www.google-analytics.com https://analytics.google.com https://region1.google-analytics.com",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://player.vimeo.com https://www.instagram.com",
  "frame-ancestors 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  "upgrade-insecure-requests",
  "report-to csp-endpoint",
  "report-uri /api/csp-report",
].join('; ');

const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  // Expanded to explicitly deny FLoC / browsing-topics / interest-cohort
  // + payment/usb/serial/bluetooth (the storefront never needs any of
  // these). fullscreen is kept as self so YouTube shorts embedded via
  // ShortsFeed can go fullscreen; camera/mic/geolocation stay disabled.
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), interest-cohort=(), browsing-topics=(), fullscreen=(self)' },
  // Cross-Origin-Opener-Policy isolates window.opener so a target=_blank
  // link can't be pivoted by a compromised destination page. rel="noopener"
  // is already used on outbound links; COOP is defense-in-depth for any
  // missed anchor.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Cross-Origin-Resource-Policy: /media/* + /_next/static/* embedded as
  // <img> / <script> by any origin is currently allowed — this hardens
  // against trivial hotlinking / attribution-stripping of brand assets.
  { key: 'Cross-Origin-Resource-Policy', value: 'same-origin' },
  // Modern Reporting API v1: browsers send `application/reports+json`
  // POSTs to this named endpoint when the CSP `report-to` directive
  // names it. Firefox still needs the legacy `report-uri` fallback
  // (also present in cspReportOnly above).
  { key: 'Reporting-Endpoints',        value: 'csp-endpoint="/api/csp-report"' },
  { key: 'Content-Security-Policy-Report-Only', value: cspReportOnly },
];

const nextConfig: NextConfig = {
  // Required for Docker deploy on EC2 — bundles app + node_modules into
  // .next/standalone so the container doesn't need npm install at runtime.
  output: 'standalone',
  // Compress HTML / static text at the Node.js runtime. ALB passes the
  // Accept-Encoding header through; with compress: true Next will gzip
  // the response. Cuts SSR HTML payload by ~70% — first-byte stays the
  // same but DOM ready arrives sooner on slow connections.
  compress: true,
  // Tree-shake heavy barrel packages. lucide-react alone exports 1000+
  // icons; without this every `import {X} from 'lucide-react'` ships the
  // full barrel into the client bundle. Embla's autoplay plugin same idea.
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'embla-carousel-react',
      'embla-carousel-autoplay',
    ],
  },
  // Don't let Turbopack bundle these — either they read their own
  // filesystem at runtime (which the standalone bundle wouldn't
  // preserve) or they reach for Node-only modules (tls, util/types,
  // fs) that the browser bundler can't resolve. Loading them from
  // node_modules at server runtime keeps both intact.
  //
  //   geoip-country     — MaxMind country lookup; reads its own
  //                       package.json to find the bundled IP→country
  //                       binary database.
  //   pg                — Postgres driver; pg/lib/stream.js does
  //                       require('tls') at module top level. The
  //                       'server-only' annotation in db/pool.ts
  //                       throws at runtime but Webpack still
  //                       statically traces the dynamic import from
  //                       api/products.ts (reachable from Header.tsx,
  //                       a Client Component) and fails the browser
  //                       build trying to resolve 'tls' / 'util/types'.
  serverExternalPackages: ['geoip-country', 'pg'],
  /**
   * The RDS dispatchers in `src/lib/api/*` do
   *
   *   if (process.env.USE_RDS === 'true') {
   *     const { fnFromPg } = await import('@/lib/db/...');
   *     ...
   *   }
   *
   * so pg is only ever reached at runtime when the flag is on, and the
   * `'server-only'` annotation on `src/lib/db/pool.ts` throws if a
   * Client Component ever imports it.
   *
   * Webpack still builds a chunk for the dynamic import in both server
   * AND client contexts (the dispatcher lives in `api/products.ts`,
   * which is reachable from `Header.tsx` — a Client Component). That
   * client-side trace resolves `pg/lib/stream.js` → `require('tls')`
   * and fails because the browser has no `tls` / `util/types` / `fs` /
   * `net` / `dns` built-ins.
   *
   * The right fix is to stub those modules as `false` in the *client*
   * bundle only. The unreachable chunk still compiles (with an empty
   * stub it would crash if called), but `USE_RDS` is never `'true'`
   * on the client so the chunk is never executed.
   *
   * Server bundle is untouched — pg + tls etc. resolve normally and
   * `serverExternalPackages: ['pg']` keeps it out of the standalone
   * bundle so node loads it from node_modules at runtime.
   */
  webpack(config, { isServer }) {
    if (!isServer) {
      config.resolve = config.resolve ?? {};
      config.resolve.fallback = {
        ...(config.resolve.fallback ?? {}),
        tls: false,
        net: false,
        fs: false,
        dns: false,
        'util/types': false,
      };
    }
    return config;
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      // Cache static public/ assets aggressively. Default was
      // Cache-Control: public, max-age=0 — meaning every visit
      // re-downloaded the SVG logo (13KB), the fonts (1.2MB total),
      // the robots.txt, etc. Probe 2026-06-21 showed both kr/en cold
      // visits re-fetched all of these. 1 week max-age + must-revalidate
      // lets the browser serve from disk cache without round-tripping.
      // SVG / WOFF2 / TTF / PNG / JPG / WEBP / AVIF / ICO are the
      // immutable-ish set; if any of these changes, the file name does
      // too (operator uploads via /admin/assets get a hashed key).
      {
        source: '/:path*.:ext(svg|woff|woff2|ttf|otf|eot|png|jpg|jpeg|webp|avif|gif|ico)',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=604800, must-revalidate' },
        ],
      },
      // Next.js webpack chunks under /_next/static/* have content-hashes
      // baked into the filename, so they are safe to mark `immutable`.
      // Without this the browser re-validates on every visit; with it,
      // repeat-visit bandwidth drops ~20% and cuts a round-trip per
      // chunk for return visitors.
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
        ],
      },
      // /api/instagram/refresh is admin-gated but lives outside
      // /api/admin/* so it wasn't covered by the route-class no-store
      // rule. Same defense-in-depth.
      {
        source: '/api/instagram/refresh',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      // Defense-in-depth: every admin + customer JSON route holds
      // PII (orders, profiles, email, role assignment) or is auth-
      // scoped per-user. CloudFront's /api/* behavior already
      // bypasses caching, but an intermediate proxy (corporate
      // gateway, mobile-carrier transparent cache, browser
      // back/forward cache) MUST NOT replay a previous user's
      // response. no-store + private + max-age=0 covers all three.
      {
        source: '/api/admin/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/api/customer/:path*',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      // /api/chat carries the OpenAI completion + the admin-configured
      // system prompt; /api/track captures session-level analytics
      // (ip_hash, device, UTM). Neither is safe for an intermediate
      // proxy or bf-cache to replay — same defense-in-depth as the
      // admin/customer rules above. The chat route additionally relies
      // on an in-memory rate limiter that loses fairness if responses
      // are cached.
      {
        source: '/api/chat',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
      {
        source: '/api/track',
        headers: [
          { key: 'Cache-Control', value: 'private, no-store, max-age=0, must-revalidate' },
          { key: 'Pragma', value: 'no-cache' },
        ],
      },
    ];
  },
  async redirects() {
    return [
      // Legacy /kr/kr/... → /kr/...
      { source: '/kr/kr/:path*', destination: '/kr/:path*', permanent: true },
      // Legacy /kr/en/... → /en/...
      { source: '/kr/en/:path*', destination: '/en/:path*', permanent: true },
      // Legacy /gl/kr/... → /kr/...
      { source: '/gl/kr/:path*', destination: '/kr/:path*', permanent: true },
      // Legacy /gl/en/... → /en/...
      { source: '/gl/en/:path*', destination: '/en/:path*', permanent: true },
    ];
  },
  images: {
    // Serve AVIF first (best compression — ~50% smaller than PNG at
    // identical visual quality), fall back to WebP, then the original.
    // Per-image source resolution is preserved; this is format-only.
    formats: ['image/avif', 'image/webp'],
    // Next 16 requires `qualities` to whitelist every quality value used
    // via the `quality` prop on <Image>. Hero / sub-hero slides ship at
    // 95 (admin uploads product photography that needs to read sharp);
    // everywhere else stays at the framework default (75) so product
    // grids + thumbnails don't bloat the cache.
    qualities: [75, 90, 95],
    remotePatterns: [
      // CloudFront /media/* — successor to Supabase Storage. Images live
      // in the kokkok-media S3 bucket and serve through the main
      // distribution. The src URL written into the DB is the public
      // CloudFront URL on our own host (same origin as the site), so
      // next/image still hits the Next.js optimizer at /_next/image and
      // the optimizer fetches the original from CloudFront.
      {
        protocol: 'https',
        hostname: 'www.kokkokgarden.com',
        pathname: '/media/**',
      },
      {
        protocol: 'https',
        hostname: 'kokkokgarden.com',
        pathname: '/media/**',
      },
      // Supabase Storage — kept until Supabase Pro is fully cancelled.
      // Any DB row that still references a legacy supabase.co URL will
      // continue to render through the optimizer until the URL is
      // rewritten via the same script used in PR #279.
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/v1/object/public/**',
      },
      // Unsplash (mock/dev images)
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
      // Flag images (flagcdn.com)
      {
        protocol: 'https',
        hostname: 'flagcdn.com',
      },
      // YouTube thumbnails (admin/shorts list)
      {
        protocol: 'https',
        hostname: 'i.ytimg.com',
      },
    ],
  },
};

// Wrap with bundle analyzer — only active when ANALYZE=true. Cheap when
// disabled (no-op wrapper). Audit 2026-06-21 added this to spot bundle
// bloat after the admin refactor + future feature additions.
export default withBundleAnalyzer({ enabled: process.env.ANALYZE === 'true' })(nextConfig);
