import type { MetadataRoute } from 'next';

/**
 * PWA manifest. Lives at /manifest.webmanifest at runtime (Next.js
 * convention via src/app/manifest.ts). Without this the site can't be
 * installed to a home screen and iOS Safari shows the generic page
 * thumbnail when shared via "Add to Home Screen."
 *
 * Icons reference the existing kokkokgarden_primary.svg — SVG is
 * accepted by Chrome / Safari / Edge for PWA install. When the
 * operator ships proper PNG icons (192px / 512px) we'll add them
 * here; the SVG keeps the install flow working today.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KOKKOK GARDEN',
    short_name: 'KOKKOK',
    description: 'Premium K-Beauty skincare featuring Heartleaf, Jericho Rose, and Sedum.',
    start_url: '/',
    display: 'standalone',
    background_color: '#ffffff',
    theme_color: '#1f2937',
    orientation: 'portrait',
    icons: [
      {
        src: '/kokkokgarden_primary.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
