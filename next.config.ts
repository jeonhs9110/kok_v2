import type { NextConfig } from "next";

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
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
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
    remotePatterns: [
      // Supabase Storage
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
    ],
  },
};

export default nextConfig;
