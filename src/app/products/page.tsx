import { headers } from 'next/headers';
import { redirect } from 'next/navigation';

/**
 * /products used to render a top-level product list that wasn't linked
 * from any canonical storefront surface — all `ProductCard` instances
 * and homepage SHOP links use `/${lang}/products`. The orphan was
 * mostly invisible while traffic redirected from elsewhere, but any
 * external link or Google-indexed entry to bare `/products` would
 * have hit it once the deploy caught up.
 *
 * Replaced with a 307 to the canonical lang-prefixed list at
 * `/[lang]/products/page.tsx`. Same language-detection rule as
 * `src/middleware.ts` so a Korean browser lands on `/kr/products`
 * and English elsewhere.
 */
export default async function ProductsLegacyRedirect() {
  const headersList = await headers();
  const accept = headersList.get('accept-language') ?? '';
  const lang = /^\s*ko\b/i.test(accept) ? 'kr' : 'en';
  redirect(`/${lang}/products`);
}
