import { headers } from 'next/headers';
import ProductsPage from '@/components/pages/ProductsPage';

export default async function ProductsRoute({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string; sub?: string }>;
}) {
  const { lang } = await params;
  const { q, category, sub } = await searchParams;
  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || headersList.get('x-user-country') || 'KR';
  return <ProductsPage lang={lang} canPurchase={country === 'KR'} searchQuery={q} categorySlug={category} subSlug={sub} />;
}
