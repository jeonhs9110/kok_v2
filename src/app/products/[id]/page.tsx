import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * /products/[id] used to render a developer stub with literal
 * placeholder text:
 *
 *   - "Target: 1000x1200 (5:6)" overlaid on every product image
 *   - "Premium Visuals Placeholder" block at the bottom of the page
 *   - "Target: 1920x1080 (16:9)" badge on the detail block
 *
 * Never linked from anywhere on the storefront (`ProductCard` uses
 * `/${lang}/products/${id}`), but reachable via direct URL,
 * external link, or any old SERP entry Google indexed. After the
 * stale deploy catches up to master, this page would have started
 * surfacing those placeholders to real customers.
 *
 * Replaced with a redirect to the canonical lang-prefixed detail at
 * `/[lang]/products/[id]/page.tsx` so:
 *   - external links keep working
 *   - SEO juice migrates via the 307
 *   - the stub source is gone (audit caught the placeholder strings
 *     on 2026-06-29)
 *
 * Language picked from Accept-Language exactly like `src/proxy.ts`
 * does for `/`. Korean default for Korean browsers; English otherwise.
 */
export default async function ProductDetailLegacyRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const headersList = await headers();
  const accept = headersList.get('accept-language') ?? '';
  const lang = /^\s*ko\b/i.test(accept) ? 'kr' : 'en';
  redirect(`/${lang}/products/${id}`);
}
