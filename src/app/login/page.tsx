import { I18nProvider } from '@/lib/i18n/context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import TopStripeBanner from '@/components/TopStripeBanner';
import {
  getCachedNavMenus,
  getCachedCategoriesTree,
  getCachedLogoUrl,
} from '@/lib/cache/header';
import { getThemeTokens } from '@/lib/theme/getThemeTokens';
import { getTopStripe } from '@/lib/api/topStripe';
import { tokensToCss } from '@/lib/theme/tokens';
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
  const [navMenus, megaCategories, logoUrl, themeTokens, topStripe] = await Promise.all([
    getCachedNavMenus(),
    getCachedCategoriesTree(),
    getCachedLogoUrl(),
    getThemeTokens(),
    getTopStripe(),
  ]);
  return (
    <I18nProvider isKorea={lang === 'kr'} lang={lang}>
      {/* Theme tokens must be injected here — /login is NOT wrapped in
          [lang]/layout.tsx, so without this <style> the Header falls
          back to default CSS variables (logo size, menu font size,
          etc.) instead of the operator's customized values. */}
      <style id="kokkok-theme-tokens" dangerouslySetInnerHTML={{ __html: tokensToCss(themeTokens) }} />
      <div className="flex flex-col min-h-screen bg-white font-sans">
        <TopStripeBanner data={topStripe} />
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
