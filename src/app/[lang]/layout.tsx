import { notFound } from 'next/navigation';
import { headers, cookies } from 'next/headers';
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
import { tokensToCss, isValidGaMeasurementId } from '@/lib/theme/tokens';
import Script from 'next/script';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
  const isKr = lang === 'kr';
  // Derive the layout-default title from the URL segment, NOT the
  // visitor's IP country. Prior IP-derived title emitted a different
  // <title> for the same URL depending on the crawler's location —
  // Naver on /en saw "— Korea", Google's US crawler on /kr saw
  // "— Global" — which fragments the hreflang cluster and downranks
  // both variants for duplicate/contradictory canonical signals.
  return {
    title: isKr ? 'KOKKOK GARDEN · 콕콕가든' : 'KOKKOK GARDEN · Korean Skincare',
    description: isKr
      ? '어성초, 여리고 장미, 세덤 성분의 프리미엄 한국 스킨케어 · 콕콕가든.'
      : 'Premium Korean skincare with Heartleaf, Jericho Rose, and Sedum. KOKKOK GARDEN.',
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

  // Cookie-consent gate for ALL non-essential tracking. GA4 + any
  // future third-party analytics tag must read this and skip injection
  // when the visitor hasn't accepted. This mirrors the PageTracker
  // gate (PR #350) — same cookie value (`kokkok_cookie_consent=accepted`),
  // same legal basis: PIPA Article 22 + 정보통신망법 Article 23 +
  // GDPR Articles 6/7 all require pre-consent for analytics cookies.
  //
  // SSR-time read means the GA <Script> tag literally isn't in the
  // HTML for un-consented visitors — strictly better than rendering it
  // and hoping a client gate kicks in before the script auto-fetches.
  // Trade-off: a visitor who accepts via the banner needs ONE
  // navigation (or refresh) before GA starts; that's the normal
  // consent-banner UX and an acceptable cost for actual compliance.
  const cookieJar = await cookies();
  const analyticsConsented = cookieJar.get('kokkok_cookie_consent')?.value === 'accepted';

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
        {/* Supabase preconnect hints were removed 2026-06-26 as part of
            the cutover to RDS + S3/CloudFront + Cognito. Hero / product /
            promo images now serve from www.kokkokgarden.com/media/* via
            CloudFront — same origin as the page, so no preconnect helps. */}
        {/* Google Analytics 4 — loaded only when the operator has
            pasted a measurement ID in /admin/theme. Enhanced
            measurement (the GA4 default) handles SPA route changes
            via the History API, so we don't need a manual page_view
            on Next.js navigation. afterInteractive defers loading
            past hydration so it doesn't compete with the critical
            path. */}
        {/* GA4 — gate on TWO conditions:
            1. operator has pasted a measurement ID in /admin/theme and
               it matches the strict G-XXXXXXXXXX format (kills XSS via
               the value interpolated into <Script src> + inline body)
            2. visitor has clicked Accept on the cookie banner (PIPA +
               GDPR — same gate as PageTracker, see consent comment
               above)
            When either fails the <Script> tag is simply omitted from
            the rendered HTML, which is the strongest possible gate —
            no third-party JS is fetched at all. */}
        {analyticsConsented && isValidGaMeasurementId(themeTokens.ga_measurement_id) && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${themeTokens.ga_measurement_id}`}
              strategy="afterInteractive"
            />
            <Script id="kokkok-ga-init" strategy="afterInteractive">
              {`window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${themeTokens.ga_measurement_id}');`}
            </Script>
          </>
        )}
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
            __html: `(function(){if(window.parent===window)return;window.addEventListener('message',function(e){if(e.origin!==location.origin)return;if(!e.data||e.data.type!=='kokkok-theme-tokens')return;var old=document.getElementById('kokkok-theme-tokens');if(!old||!old.parentNode)return;var fresh=document.createElement('style');fresh.id='kokkok-theme-tokens';fresh.textContent=e.data.css;old.parentNode.replaceChild(fresh,old);});})();`,
          }}
        />
        <script
          dangerouslySetInnerHTML={{
            // /admin/homepage builder → scroll + highlight a section
            // when the admin clicks its card. Adds a temporary outline
            // class so the storefront pulses blue where the click
            // landed, then smooth-scrolls so the operator can see where
            // the edits land without leaving the hub. iframe-only guard
            // matches the theme-tokens listener above.
            __html: `(function(){if(window.parent===window)return;window.addEventListener('message',function(e){if(e.origin!==location.origin)return;if(!e.data||e.data.type!=='kokkok-builder-highlight')return;var key=e.data.sectionKey;if(!key)return;var el=document.querySelector('[data-builder-section="'+key+'"]');if(!el)return;try{el.scrollIntoView({behavior:'smooth',block:'start'});}catch(_){el.scrollIntoView();}el.classList.remove('kokkok-builder-highlight');void el.offsetWidth;el.classList.add('kokkok-builder-highlight');setTimeout(function(){el.classList.remove('kokkok-builder-highlight');},2400);});})();`,
          }}
        />
        <div className="flex flex-col min-h-screen">
          {/* Non-Korea visitors see a system notice that products can
              only be ordered inside South Korea. Rendered HERE (above
              the sticky header) rather than inside [lang]/page.tsx so
              the carousel's .kokkok-hero-overlay negative margin
              (PR #147) can't pull the hero up over it. */}
          {!isKorea && (
            <div className="bg-gradient-to-r from-brand-notice-from to-brand-notice-to text-white text-center py-2 px-4 text-[13px] font-medium">
              🌏 {lang === 'kr'
                ? '글로벌 스토어입니다 — 주문은 한국 스토어를 이용해주세요'
                : 'Global store — Products are available for purchase in South Korea only'}
            </div>
          )}
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
          <main id="main-content" className="flex-1 w-full overflow-x-hidden">{children}</main>
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
