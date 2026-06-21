import { headers } from 'next/headers';
import type { Metadata } from 'next';
import ProductDetailPage from '@/components/pages/ProductDetailPage';
import { getProducts } from '@/lib/api/products';

/**
 * Per-product metadata. Without this, Google/Kakao/Slack previews show the
 * generic homepage title for every product link — a missed conversion every
 * time the operator shares a product URL. Falls back to the layout-level
 * title if the product isn't found (the page itself returns the not-found
 * UI; the metadata function can't call notFound()).
 */
export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang, id } = await params;
  const products = await getProducts();
  const product = products.find(p => p.id === id);
  if (!product) {
    return {
      title: '상품을 찾을 수 없습니다 · KOKKOK GARDEN',
      robots: { index: false, follow: true },
    };
  }
  const title = `${product.name} · KOKKOK GARDEN`;
  const desc = product.summary || product.description || product.name;
  const image = product.imageUrl || undefined;
  const url = `https://www.kokkokgarden.com/${lang}/products/${id}`;
  return {
    title,
    description: desc,
    alternates: {
      canonical: url,
      languages: {
        kr: `https://www.kokkokgarden.com/kr/products/${id}`,
        en: `https://www.kokkokgarden.com/en/products/${id}`,
      },
    },
    openGraph: {
      title,
      description: desc,
      url,
      type: 'website',
      images: image ? [{ url: image, width: 1200, height: 1200, alt: product.name }] : undefined,
      locale: lang === 'kr' ? 'ko_KR' : 'en_US',
      siteName: 'KOKKOK GARDEN',
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description: desc,
      images: image ? [image] : undefined,
    },
  };
}

export default async function ProductDetailRoute({ params }: { params: Promise<{ lang: string; id: string }> }) {
  const { lang, id } = await params;
  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || headersList.get('x-user-country') || 'KR';

  // JSON-LD Product schema — drives Google's rich snippets (price chip +
  // availability chip + image in SERP). Without this the listing shows
  // only the title + meta description even when the product page is rich.
  const products = await getProducts();
  const product = products.find(p => p.id === id);
  const ld = product
    ? {
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: product.name,
        description: product.summary || product.description || '',
        image: product.imageUrl ? [product.imageUrl] : undefined,
        sku: product.id,
        brand: { '@type': 'Brand', name: 'KOKKOK GARDEN' },
        offers: {
          '@type': 'Offer',
          priceCurrency: 'KRW',
          price: product.price,
          availability: product.is_active
            ? 'https://schema.org/InStock'
            : 'https://schema.org/Discontinued',
          url: `https://www.kokkokgarden.com/${lang}/products/${id}`,
        },
      }
    : null;

  return (
    <>
      {ld && (
        <script
          type="application/ld+json"
          // Schema.org-valid JSON. Pretty-print kept off — saves bytes on
          // SSR and search crawlers don't care about whitespace.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }}
        />
      )}
      <ProductDetailPage lang={lang} canPurchase={country === 'KR'} id={id} />
    </>
  );
}
