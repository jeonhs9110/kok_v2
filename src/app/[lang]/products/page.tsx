import { headers } from 'next/headers';
import type { Metadata } from 'next';
import ProductsPage from '@/components/pages/ProductsPage';

const META: Record<string, { title: string; description: string }> = {
  kr: {
    title: '전체 상품 · KOKKOK GARDEN',
    description: '제주 동백 PDRN 성분의 K-뷰티 스킨케어 전 라인업. 토너, 세럼, 크림, 마스크를 한 곳에서 만나보세요.',
  },
  en: {
    title: 'All Products · KOKKOK GARDEN',
    description: 'The full KOKKOK GARDEN K-Beauty lineup — toners, serums, creams, and masks crafted with Jeju Camellia PDRN.',
  },
};

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Promise<{ lang: string }>;
  searchParams: Promise<{ q?: string; category?: string; sub?: string }>;
}): Promise<Metadata> {
  const { lang } = await params;
  const { q, category } = await searchParams;
  const base = META[lang] ?? META.en;
  // Search + filtered views shouldn't be indexed — they multiply into
  // thousands of low-value URL variants (every typo, every category
  // combo). Canonicalize back to /[lang]/products for the catalog.
  const noindex = !!(q || category);
  return {
    title: base.title,
    description: base.description,
    robots: noindex ? { index: false, follow: true } : undefined,
    alternates: {
      canonical: `https://www.kokkokgarden.com/${lang}/products`,
      languages: {
        kr: 'https://www.kokkokgarden.com/kr/products',
        en: 'https://www.kokkokgarden.com/en/products',
      },
    },
    openGraph: {
      title: base.title,
      description: base.description,
      url: `https://www.kokkokgarden.com/${lang}/products`,
      type: 'website',
      locale: lang === 'kr' ? 'ko_KR' : 'en_US',
      siteName: 'KOKKOK GARDEN',
    },
  };
}

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
