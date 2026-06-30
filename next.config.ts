import type { NextConfig } from "next";
import withBundleAnalyzer from '@next/bundle-analyzer';

// Baseline security headers applied to every response. Cheap defense
// against the obvious browser-side attack classes (clickjacking, MIME
// sniffing, HTTPS downgrade). HSTS preload list eligibility requires
// max-age >= 1y AND includeSubDomains AND preload — keep all three.
// No CSP yet: building a non-breaking policy needs an audit of every
// external script/font/image source; safer to ship without and add
// after a separate hardening pass.
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options',           value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
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
