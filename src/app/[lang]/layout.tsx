import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { isValidLang } from '@/lib/i18n/types';
import { I18nProvider } from '@/lib/i18n/context';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AIChatbot from '@/components/AIChatbot';
import PageTracker from '@/components/PageTracker';
import { CartProvider } from '@/lib/cart/CartContext';

export async function generateMetadata({ params }: { params: Promise<{ lang: string }> }) {
  const { lang } = await params;
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

  return (
    <I18nProvider isKorea={isKorea} lang={lang}>
      <CartProvider>
        <div className="flex flex-col min-h-screen">
          <Header canPurchase={isKorea} />
          <main className="flex-1 w-full bg-white">{children}</main>
          <Footer />
          {!isKorea && <AIChatbot />}
          <PageTracker />
        </div>
      </CartProvider>
    </I18nProvider>
  );
}
