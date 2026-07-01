import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * Root `/` geo-router. Redirects to `/kr` or `/en` based on the
 * visitor's country.
 *
 * Round 30: matched proxy.ts + [lang]/page.tsx headers priority
 * (`cloudfront-viewer-country` is the only trusted geo signal on
 * EC2 + ALB + CloudFront — Vercel only hosts DNS, so
 * `x-vercel-ip-country` is client-spoofable and never fires on
 * prod). Default flipped to `KR` (primary market) so the fallback
 * path matches proxy.ts's default. Prior US default routed every
 * KR visitor whose CDN headers didn't reach here (edge case) to
 * `/en` and showed the "global store" banner — inverted default.
 */
export default async function RootRedirectPage() {
  const headersList = await headers();
  const country =
    headersList.get('cloudfront-viewer-country')
    || headersList.get('x-user-country')
    || 'KR';

  if (country === 'KR') {
    redirect('/kr');
  } else {
    redirect('/en');
  }
}
