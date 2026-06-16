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
import { getTopStripe } from '@/lib/api/topStripe';
import TopStripeBanner from '@/components/TopStripeBanner';
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
  const [initialNavMenus, initialMegaCategories, initialLogoUrl, themeTokens, topStripe] = await Promise.all([
    getCachedNavMenus(),
    getCachedCategoriesTree(),
    getCachedLogoUrl(),
    getThemeTokens(),
    getTopStripe(),
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
            // Bulletproof postMessage listener for the /admin/theme live
            // preview. Previously mutated <style>.textContent in place;
            // that's supposed to re-parse the rule but admins reported
            // not seeing the change. Now we REPLACE the entire <style>
            // element — old node out, new node in — which guarantees
            // CSS recompute in every browser. The iframe-only guard
            // (window.parent !== window) keeps a standalone /kr load
            // from wasting a message-listener slot.
            __html: `(function(){if(window.parent===window)return;window.addEventListener('message',function(e){if(!e.data||e.data.type!=='kokkok-theme-tokens')return;var old=document.getElementById('kokkok-theme-tokens');if(!old||!old.parentNode)return;var fresh=document.createElement('style');fresh.id='kokkok-theme-tokens';fresh.textContent=e.data.css;old.parentNode.replaceChild(fresh,old);});})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            // /admin/homepage builder → scroll + highlight a section
            // when the admin clicks its card. Adds a temporary outline
            // class so the storefront pulses blue where the click
            // landed, then smooth-scrolls so Songyi can see where the
            // edits land without leaving the hub. iframe-only guard
            // matches the theme-tokens listener above.
            __html: `(function(){if(window.parent===window)return;window.addEventListener('message',function(e){if(!e.data||e.data.type!=='kokkok-builder-highlight')return;var key=e.data.sectionKey;if(!key)return;var el=document.querySelector('[data-builder-section="'+key+'"]');if(!el)return;try{el.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){el.scrollIntoView();}el.classList.remove('kokkok-builder-highlight');void el.offsetWidth;el.classList.add('kokkok-builder-highlight');setTimeout(function(){el.classList.remove('kokkok-builder-highlight');},2400);});})();`,
          }}
        />
        <div className="flex flex-col min-h-screen">
          <div data-builder-section="top-stripe">
            <TopStripeBanner data={topStripe} />
          </div>
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
          {/* overflow-x-hidden guards against any per-route horizontal
              overflow (e.g. an admin-set hero title with an aggressive
              size offset that wraps poorly on small phones) bleeding
              into a global horizontal scroll. Header sits outside <main>
              so its sticky positioning is unaffected. */}
          <main className="flex-1 w-full overflow-x-hidden">{children}</main>
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
