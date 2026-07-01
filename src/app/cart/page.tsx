import type { Metadata } from 'next';
import { I18nProvider } from '@/lib/i18n/context';
import { CartProvider } from '@/lib/cart/CartContext';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  getCachedNavMenus,
  getCachedCategoriesTree,
  getCachedLogoUrl,
} from '@/lib/cache/header';
import { detectLangServer } from '@/lib/i18n/detectServer';
import CartContent from './_components/CartContent';

// /cart is a per-visitor page (localStorage-only cart) — indexing it
// wastes an impression on a page every visitor sees blank. Keep the
// title so operator-shared links still show a sane preview, but block
// SERP indexing. robots.txt also carries a Disallow entry so crawlers
// don't even fetch.
export const metadata: Metadata = {
  title: '장바구니 · KOKKOK GARDEN',
  robots: { index: false, follow: true },
};

/**
 * /cart — server shell. Mounts its own CartProvider (the cart route sits
 * outside `[lang]/` so it doesn't inherit the layout's provider). Same
 * localStorage source under both, so additions made on storefront pages
 * appear here on next mount.
 */
export default async function CartPage() {
  const lang = await detectLangServer();
  const [navMenus, megaCategories, logoUrl] = await Promise.all([
    getCachedNavMenus(),
    getCachedCategoriesTree(),
    getCachedLogoUrl(),
  ]);
  return (
    <I18nProvider isKorea={lang === 'kr'} lang={lang}>
      <CartProvider>
        <div className="min-h-screen bg-white flex flex-col font-sans">
          <Header
            canPurchase={true}
            initialNavMenus={navMenus}
            initialMegaCategories={megaCategories}
            initialLogoUrl={logoUrl}
          />
          <main id="main-content" className="flex-1 bg-white">
            <CartContent />
          </main>
          <Footer lang={lang} />
        </div>
      </CartProvider>
    </I18nProvider>
  );
}
