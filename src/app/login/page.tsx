import { I18nProvider } from '@/lib/i18n/context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  getCachedNavMenus,
  getCachedCategoriesTree,
  getCachedLogoUrl,
} from '@/lib/cache/header';
import { detectLangServer } from '@/lib/i18n/detectServer';
import LoginForm from './_components/LoginForm';

/**
 * /login — server component shell. Reads the visitor's language from the
 * cookie / `accept-language` header server-side, fetches the header data
 * (nav menus, mega-categories, logo) from the same cached helpers
 * `[lang]/layout.tsx` uses, and hands the actual form off to a client
 * `<LoginForm>` child. This replaces the previous top-level `'use client'`
 * page that shipped the entire layout (including a client-side Footer)
 * over the wire.
 */
export default async function LoginPage() {
  const lang = await detectLangServer();
  const [navMenus, megaCategories, logoUrl] = await Promise.all([
    getCachedNavMenus(),
    getCachedCategoriesTree(),
    getCachedLogoUrl(),
  ]);
  return (
    <I18nProvider isKorea={lang === 'kr'} lang={lang}>
      <div className="flex flex-col min-h-screen bg-white font-sans">
        <Header
          canPurchase={true}
          initialNavMenus={navMenus}
          initialMegaCategories={megaCategories}
          initialLogoUrl={logoUrl}
        />
        <LoginForm lang={lang} />
        <Footer lang={lang} />
      </div>
    </I18nProvider>
  );
}
