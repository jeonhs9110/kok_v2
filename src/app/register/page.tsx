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
import RegisterForm from './_components/RegisterForm';

export default async function RegisterPage() {
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
      {/* Theme tokens must be injected here — /register is NOT wrapped
          in [lang]/layout.tsx, so without this <style> the Header
          falls back to default CSS variables (logo size, menu font
          size, etc.) instead of the operator's customized values. */}
      <style id="kokkok-theme-tokens" dangerouslySetInnerHTML={{ __html: tokensToCss(themeTokens) }} />
      <div className="flex flex-col min-h-screen bg-white font-sans">
        <TopStripeBanner data={topStripe} />
        <Header
          canPurchase={true}
          initialNavMenus={navMenus}
          initialMegaCategories={megaCategories}
          initialLogoUrl={logoUrl}
        />
        <main className="flex-1 w-full flex items-center justify-center px-4 py-16 animate-in fade-in duration-500">
          <RegisterForm lang={lang} />
        </main>
        <Footer lang={lang} />
      </div>
    </I18nProvider>
  );
}
