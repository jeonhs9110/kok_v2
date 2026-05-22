import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';
import StorefrontLayoutWrapper from '@/components/StorefrontLayoutWrapper';
import SiteBackground from '@/components/SiteBackground';

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
      </head>
      <body className={`${freesentation.className} bg-white text-neutral-950 antialiased min-h-screen`}>
        <SiteBackground />
        <StorefrontLayoutWrapper>
          {children}
        </StorefrontLayoutWrapper>
      </body>
    </html>
  );
}
