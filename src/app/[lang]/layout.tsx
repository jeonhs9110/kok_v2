import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { isValidLang } from '@/lib/i18n/types';
import { I18nProvider } from '@/lib/i18n/context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AIChatbot from '@/components/AIChatbot';
import CookieConsent from '@/components/CookieConsent';
import PageTracker from '@/components/PageTracker';
import { CartProvider } from '@/lib/cart/CartContext';
import { WishlistProvider } from '@/lib/wishlist/WishlistContext';
import { getCachedNavMenus, getCachedCategoriesTree, getCachedLogoUrl } from '@/lib/cache/header';
import { getThemeTokens } from '@/lib/theme/getThemeTokens';
import { tokensToCss } from '@/lib/theme/tokens';

export async function generateMetadata() {
  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || headersList.get('x-user-country') || 'KR';
  const isKorea = country === 'KR';
  return {
    title: isKorea ? 'Kokkok Garden — Korea' : 'Kokkok Garden — Global',
    description: 'Premium Korean Skincare — Shop Heartleaf, Jericho Rose, and Sedum skincare.',
  };
}

export default async function LangLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ lang: string }>;
}) {
  const { lang } = await params;
  if (!isValidLang(lang)) notFound();

  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || headersList.get('x-user-country') || 'KR';
  const isKorea = country === 'KR';

  // SSR the header's dynamic data so the initial HTML already has the
  // full nav, mega-categories, and logo. Without this, the client-side
  // useEffect inside Header would fetch these after mount and the visible
  // header would expand from "Product / SHOP Worldwide" to the full bar
  // a few hundred ms later — a layout shift the operator complained about.
  const [initialNavMenus, initialMegaCategories, initialLogoUrl, themeTokens] = await Promise.all([
    getCachedNavMenus(),
    getCachedCategoriesTree(),
    getCachedLogoUrl(),
    getThemeTokens(),
  ]);

  return (
    <I18nProvider isKorea={isKorea} lang={lang}>
      <CartProvider>
        <WishlistProvider>
        {/* Theme tokens override the defaults baked into globals.css.
            Inline <style> rather than a CSS file so admin edits show
            up on the next request — no cache invalidation needed.
            The postMessage listener below lets the /admin/theme
            editor iframe push live updates without a reload. */}
        <style id="kokkok-theme-tokens" dangerouslySetInnerHTML={{ __html: tokensToCss(themeTokens) }} />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(window.parent===window)return;window.addEventListener('message',function(e){if(!e.data||e.data.type!=='kokkok-theme-tokens')return;var s=document.getElementById('kokkok-theme-tokens');if(s)s.textContent=e.data.css;});})();`,
          }}
        />
        <div className="flex flex-col min-h-screen">
          <Header
            canPurchase={isKorea}
            initialNavMenus={initialNavMenus}
            initialMegaCategories={initialMegaCategories}
            initialLogoUrl={initialLogoUrl}
          />
          {/* main is transparent so the SiteBackground (-z-10 fixed layer)
              can show through wherever individual sections don't paint
              over it. Sections that want a solid backdrop (cards, hero
              slides, ShortsFeed black, Footer white, etc.) set their own
              bg-*; everything else lets the SiteBackground show. When no
              active background exists, SiteBackground renders a white
              fallback so the default look matches the pre-feature state. */}
          <main className="flex-1 w-full">{children}</main>
          <Footer lang={lang} />
          <AIChatbot isKorea={isKorea} />
          <CookieConsent />
          <PageTracker />
        </div>
        </WishlistProvider>
      </CartProvider>
    </I18nProvider>
  );
}
