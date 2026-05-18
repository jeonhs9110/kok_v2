import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Required for Docker deploy on EC2 — bundles app + node_modules into
  // .next/standalone so the container doesn't need npm install at runtime.
  output: 'standalone',
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
