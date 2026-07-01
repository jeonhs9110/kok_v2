import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import localFont from 'next/font/local';
import './globals.css';
import StorefrontLayoutWrapper from '@/components/StorefrontLayoutWrapper';
import SiteBackground from '@/components/SiteBackground';
import TailwindSafelist from '@/components/TailwindSafelist';
import { getActiveSiteBackground } from '@/lib/api/siteBackground';
import { detectLangServer } from '@/lib/i18n/detectServer';

// Only 400 (Regular) and 700 (Bold) are preloaded. Those are the two
// weights the homepage paints on the critical path (body copy + menu
// labels + product names). The other five weights still LOAD when CSS
// references them — they just don't bloat the `<link rel=preload>` set
// in the document head, so first-byte ships 5 × 1.25MB lighter. With
// font-display: swap, the browser shows the loaded fallback until the
// requested weight arrives.
const freesentation = localFont({
  src: [
    { path: '../../public/fonts/Freesentation-4Regular.ttf', weight: '400', style: 'normal' },
    { path: '../../public/fonts/Freesentation-7Bold.ttf',    weight: '700', style: 'normal' },
  ],
  variable: '--font-freesentation',
  display: 'swap',
});

// Extra weights — declared so CSS that references font-weight: 300/500/
// 600/800/900 still resolves correctly, but with preload: false so the
// browser only fetches the file when the page actually uses that weight.
// Shares the same CSS variable as the primary declaration above.
const freesentationExtras = localFont({
  src: [
    { path: '../../public/fonts/Freesentation-3Light.ttf',     weight: '300', style: 'normal' },
    { path: '../../public/fonts/Freesentation-5Medium.ttf',    weight: '500', style: 'normal' },
    { path: '../../public/fonts/Freesentation-6SemiBold.ttf',  weight: '600', style: 'normal' },
    { path: '../../public/fonts/Freesentation-8ExtraBold.ttf', weight: '800', style: 'normal' },
    { path: '../../public/fonts/Freesentation-9Black.ttf',     weight: '900', style: 'normal' },
  ],
  variable: '--font-freesentation',
  display: 'swap',
  preload: false,
});

export const viewport: Viewport = {
  // theme-color drives the Android Chrome address-bar tint and the
  // iOS PWA status-bar background. Brand ink matches the storefront
  // header so the chrome feels continuous with the page. Moved out
  // of metadata 2026-06-30 — Next 16 logs a deprecation warning when
  // theme-color / appleWebApp.statusBarStyle live on `metadata`.
  themeColor: '#1f2937',
  // Round 28: viewport-fit=cover so env(safe-area-inset-*) resolves
  // to real values inside iOS KakaoTalk / Instagram in-app WebViews.
  // Prior default of 'auto' left the insets at 0 in-app, and the
  // AIChatbot FAB + CookieConsent Accept button rendered behind the
  // iOS home indicator — un-tappable, so Kakao-arriving customers
  // silently missed the consent banner (GA4 stayed denied for the
  // whole session).
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  metadataBase: new URL('https://www.kokkokgarden.com'),
  // Round 30: dropped the `template: '%s · KOKKOK GARDEN'` — every
  // child page's `title` string already ends with `· KOKKOK GARDEN`,
  // and Next.js's Metadata template WRAPS string titles, so the
  // browser tab + SERP entry rendered as
  // `전체 상품 · KOKKOK GARDEN · KOKKOK GARDEN` (double brand suffix,
  // >60 chars, Google truncates + downranks the duplicated token).
  // Simpler than editing every child: keep the child titles verbatim,
  // and use a plain-string default title so no template is applied.
  title: 'KOKKOK GARDEN',
  // Round 30: description intentionally NOT set at the root. The
  // English default here used to leak onto /kr pages whose child
  // `generateMetadata` returned `{}` on error — Korean SERP snippet
  // showed English gibberish under a Korean title. `[lang]/layout.tsx`
  // already sets a language-branched default; that one wins.
  manifest: '/manifest.webmanifest',
  applicationName: 'KOKKOK GARDEN',
  appleWebApp: {
    capable: true,
    title: 'KOKKOK GARDEN',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
  verification: {
    // Naver Search Advisor site-ownership claim. Code provided by the
    // operator after registering kokkokgarden.com at searchadvisor.naver.com
    // — keep until Naver retires the meta-tag method or the site moves domains.
    other: {
      'naver-site-verification': '0e893c9afdf558a2e821359770bfcc74cdadf7b5',
    },
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // SSR the active background row once per render. Cached for 60s via
  // unstable_cache; tag-evicted when the admin saves a new background.
  // Replaces the 1.3s client-side fetch SiteBackground used to do.
  const initialBg = await getActiveSiteBackground();
  // Dynamic <html lang>. Was hardcoded to "ko" — that broke screen
  // reader pronunciation for English visitors AND told Google/Naver
  // the /en pages were Korean (contradicting the hreflang alternates).
  // detectLangServer reads kokkok_lang cookie → accept-language → 'kr',
  // matching what the [lang]/ routes themselves use.
  const lang = await detectLangServer();
  return (
    <html lang={lang === 'en' ? 'en-US' : 'ko-KR'} className={`${freesentation.variable} ${freesentationExtras.variable}`}>
      <head>
        {/* Preload the critical Regular weight so it starts downloading
            during HTML parse instead of waiting for the CSS to declare
            the font-face. Audit 2026-06-21: without this, the font
            request chain was HTML → CSS → font, costing ~80-150ms LCP
            on a cold visit. Bold weight (the other preloaded weight)
            loads alongside as a slightly-later parallel request — fine
            because body copy paints first, headlines a tick later. */}
        <link
          rel="preload"
          href="/fonts/Freesentation-4Regular.ttf"
          as="font"
          type="font/ttf"
          crossOrigin="anonymous"
        />

        {/* Adobe Fonts — Tablet Gothic (영문 브랜드 서체). preconnect first so
            the TLS handshake overlaps the HTML stream. Round 23: switch
            the actual stylesheet to the print-then-swap non-blocking
            pattern — Typekit CSS was blocking first paint even though
            the font is Latin-only and only used on brand headlines that
            paint after LCP. Trade-off: brief flash of fallback font for
            the English brand copy, which is acceptable given the
            LCP win (-150–350ms on cold visits). */}
        <link rel="preconnect" href="https://use.typekit.net" crossOrigin="anonymous" />
        <link rel="preconnect" href="https://p.typekit.net" crossOrigin="anonymous" />
        {/* Round 27: replaced the `onLoad="this.media='all'"` string-
            cast hack with a real Script that flips the media attribute
            on the print-media stylesheet after it loads. React 19 +
            Next 16 strip unknown DOM attributes on Server Components,
            so the prior string-cast onLoad silently disappeared —
            Typekit CSS was blocking first paint again. */}
        <link
          rel="stylesheet"
          href="https://use.typekit.net/czr4kvy.css?display=swap"
          media="print"
          data-media-swap="typekit"
        />
        <Script id="typekit-media-swap" strategy="beforeInteractive">
          {`document.querySelectorAll('link[data-media-swap="typekit"]').forEach(function(l){l.media='all';});`}
        </Script>
        <noscript>
          <link rel="stylesheet" href="https://use.typekit.net/czr4kvy.css?display=swap" />
        </noscript>

        {/* Optional admin-selectable fonts. Listed in src/lib/typography/options.ts
            and exposed to the admin via FONT_OPTIONS. Loaded with display=swap
            so the page renders in fallback fonts immediately; the chosen face
            paints in once it arrives. Only used on hero / sub-hero / carousel
            text so the network cost stays off the critical path of product
            grids and the cart. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font --
            The @next/next/no-page-custom-font rule is Pages-Router-only
            advice ("put fonts in _document.js"). In App Router, the
            documented place for custom font <link> tags IS the root
            layout.tsx <head>, so this warning is a known false positive
            we acknowledge once here rather than chasing every release. */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;700&family=Inter:wght@400;700&family=Nanum+Myeongjo:wght@400;700;800&family=Noto+Sans+KR:wght@400;700;900&family=Playfair+Display:wght@400;700;900&display=swap"
        />
        {/* Pretendard isn't on Google Fonts; pulled from the official CDN. */}
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.min.css"
        />
      </head>
      {/* Dropping freesentation.className from the body — that class set
          font-family directly on the body element and beat the
          `body { font-family: var(--font-body, …) }` CSS rule on
          specificity, so the admin's /admin/theme → 본문 폰트 picker
          silently did nothing. The freesentation.variable on <html>
          above still exposes --font-freesentation, and globals.css's
          body rule references that var in its fallback stack, so
          customers who haven't picked an admin font still see
          Freesentation as before. */}
      <body className="text-neutral-950 antialiased min-h-screen">
        {/* Skip-to-content link — keyboard users can press Tab once on
            any page to bypass the 20+ header links and jump straight
            to the main content. Hidden visually until focused.
            WCAG 2.4.1 Bypass Blocks. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:px-3 focus:py-2 focus:bg-black focus:text-white focus:text-sm focus:rounded focus:no-underline"
        >
          {lang === 'en' ? 'Skip to content' : '본문으로 건너뛰기'}
        </a>
        <SiteBackground initialBg={initialBg} />
        <TailwindSafelist />
        <StorefrontLayoutWrapper>
          {children}
        </StorefrontLayoutWrapper>
      </body>
    </html>
  );
}
