import type { Metadata } from 'next';
import { Noto_Sans_KR } from 'next/font/google';
import './globals.css';
import StorefrontLayoutWrapper from '@/components/StorefrontLayoutWrapper';

const notoSans = Noto_Sans_KR({ subsets: ['latin'], weight: ['300', '400', '500', '600', '700', '800', '900'] });

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
    <html lang="ko">
      <body className={`${notoSans.className} bg-white text-neutral-950 antialiased min-h-screen`}>
        <StorefrontLayoutWrapper>
          {children}
        </StorefrontLayoutWrapper>
      </body>
    </html>
  );
}
