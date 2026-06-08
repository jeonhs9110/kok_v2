import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import StorefrontLayoutWrapper from '@/components/StorefrontLayoutWrapper';
import SiteBackground from '@/components/SiteBackground';
import TailwindSafelist from '@/components/TailwindSafelist';

const freesentation = localFont({
  src: [
    { path: '../../public/fonts/Freesentation-3Light.ttf',     weight: '300', style: 'normal' },
    { path: '../../public/fonts/Freesentation-4Regular.ttf',   weight: '400', style: 'normal' },
    { path: '../../public/fonts/Freesentation-5Medium.ttf',    weight: '500', style: 'normal' },
    { path: '../../public/fonts/Freesentation-6SemiBold.ttf',  weight: '600', style: 'normal' },
    { path: '../../public/fonts/Freesentation-7Bold.ttf',      weight: '700', style: 'normal' },
    { path: '../../public/fonts/Freesentation-8ExtraBold.ttf', weight: '800', style: 'normal' },
    { path: '../../public/fonts/Freesentation-9Black.ttf',     weight: '900', style: 'normal' },
  ],
  variable: '--font-freesentation',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Kokkok Garden',
  description: 'Premium Skincare featuring Heartleaf, Jericho Rose, and Sedum.',
  verification: {
    // Naver Search Advisor site-ownership claim. Code provided by 송이
    // after registering kokkokgarden.com at searchadvisor.naver.com — keep
    // until Naver retires the meta-tag method or the site moves domains.
    other: {
      'naver-site-verification': '0e893c9afdf558a2e821359770bfcc74cdadf7b5',
    },
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" className={freesentation.variable}>
      <head>
        {/* Adobe Fonts — Tablet Gothic (영문 브랜드 서체) */}
        <link rel="stylesheet" href="https://use.typekit.net/czr4kvy.css" />

        {/* Optional admin-selectable fonts. Listed in src/lib/typography/options.ts
            and exposed to the admin via FONT_OPTIONS. Loaded with display=swap
            so the page renders in fallback fonts immediately; the chosen face
            paints in once it arrives. Only used on hero / sub-hero / carousel
            text so the network cost stays off the critical path of product
            grids and the cart. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
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
        <SiteBackground />
        <TailwindSafelist />
        <StorefrontLayoutWrapper>
          {children}
        </StorefrontLayoutWrapper>
      </body>
    </html>
  );
}
