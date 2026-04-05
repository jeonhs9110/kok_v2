import { headers } from 'next/headers';
import ProductDetailPage from '@/components/pages/ProductDetailPage';

export default async function ProductDetailRoute({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || headersList.get('x-user-country') || 'KR';
  return <ProductDetailPage lang={lang} canPurchase={country === 'KR'} id={id} />;
}
