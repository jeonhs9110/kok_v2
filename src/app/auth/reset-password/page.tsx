import { I18nProvider } from '@/lib/i18n/context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import {
  getCachedNavMenus,
  getCachedCategoriesTree,
  getCachedLogoUrl,
} from '@/lib/cache/header';
import { detectLangServer } from '@/lib/i18n/detectServer';
import ResetPasswordForm from './_components/ResetPasswordForm';

export default async function ResetPasswordPage() {
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
        <main className="flex-1 w-full flex items-center justify-center px-4 py-16 animate-in fade-in duration-500">
          <ResetPasswordForm />
        </main>
        <Footer lang={lang} />
      </div>
    </I18nProvider>
  );
}
