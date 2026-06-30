import type { MetadataRoute } from 'next';

/**
 * PWA manifest. Lives at /manifest.webmanifest at runtime (Next.js
 * convention via src/app/manifest.ts).
 *
 * Icon priority list (browsers walk it top-down and use the first that
 * loads):
 *   1. /icon-192.png  — sharp iOS install icon, ships when the design
 *                       team delivers (operator request sent 2026-06-30).
 *   2. /icon-512.png  — same, larger size; Chrome PWA + Android.
 *   3. /kokkokgarden_primary.svg — SVG fallback that already ships.
 *      Keeps the install flow working today; gets superseded as soon
 *      as the PNGs land in /public/.
 *
 * Drop-in is literally:
 *   - copy icon-192.png + icon-512.png into /public/
 *   - redeploy
 * No code change needed.
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
        src: '/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/kokkokgarden_primary.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
  };
}
