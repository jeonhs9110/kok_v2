import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ProductDetailPage from '@/components/pages/ProductDetailPage';
import { getProducts } from '@/lib/api/products';

// UUID v4 (or general lowercase-hex UUID) shape. Guards `[id]` from
// bot scans that guess random strings — without this, every
// `/kr/products/aaaaa` request pulled the full products cache to
// find nothing, and returned 200 with a not-found body. UUID-shape
// mismatch → immediate 404 → no wasted fetch + correct HTTP status.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Per-product metadata. Without this, Google/Kakao/Slack previews show the
 * generic homepage title for every product link — a missed conversion every
 * time the operator shares a product URL. Falls back to the layout-level
 * title if the product isn't found (the page itself returns the not-found
 * UI; the metadata function can't call notFound()).
 */
export async function generateMetadata({ params }: { params: Promise<{ lang: string; id: string }> }): Promise<Metadata> {
  const { lang, id } = await params;
  if (!UUID_RE.test(id)) {
    return {
      title: lang === 'kr' ? '상품을 찾을 수 없습니다 · KOKKOK GARDEN' : 'Product Not Found · KOKKOK GARDEN',
      robots: { index: false, follow: true },
    };
  }
  // getProducts() throws on transient RDS/pool failures. A throw
  // inside generateMetadata is NOT caught by error.tsx — Next.js
  // drops the page with a bare 500 and no branded chrome. Fall
  // back to the layout-default metadata so the page body (which
  // reads the same cached fetch) can still render.
  let products;
  try {
    products = await getProducts();
  } catch (err) {
    console.error('[products/[id]] generateMetadata getProducts threw', err);
    return {};
  }
  // Mirror the page-body filter: an inactive product is "gone" for the
  // storefront, including its OG metadata. Without this Google etc.
  // keep the rich snippet (price/availability) alive after admin marks
  // a product is_active=false — a customer clicking a SERP result lands
  // on the not-found body but the search result still advertises the
  // product as in-stock until the next crawl.
  const product = products.find(p => p.id === id && p.is_active);
  if (!product) {
    return {
      title: lang === 'kr' ? '상품을 찾을 수 없습니다 · KOKKOK GARDEN' : 'Product Not Found · KOKKOK GARDEN',
      robots: { index: false, follow: true },
    };
  }
  // SEO overrides — operator-configured per-product values from
  // /admin/products → SEO 설정. Falls back to product.name / summary
  // when each field is empty, so unmigrated rows render identically.
  const seo = product.seo;
  const title = seo?.title?.trim()
    ? `${seo.title.trim()} · KOKKOK GARDEN`
    : `${product.name} · KOKKOK GARDEN`;
  const desc = seo?.description?.trim()
    || product.summary
    || product.description
    || product.name;
  const image = product.imageUrl || undefined;
  const imageAlt = seo?.imageAlt?.trim() || product.name;
  const url = `https://www.kokkokgarden.com/${lang}/products/${id}`;
  const indexable = seo?.indexable !== false;
  return {
    title,
    description: desc,
    keywords: seo?.keywords?.trim() || undefined,
    authors: seo?.author?.trim() ? [{ name: seo.author.trim() }] : undefined,
    robots: indexable ? undefined : { index: false, follow: true },
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
      // Let scrapers auto-detect dimensions. Product images are 1:1
      // in storage; hardcoding 1200x1200 caused Facebook/LinkedIn to
      // center-crop the bottle labels off when they enforce a 1.91:1
      // preview card. Omitting width/height lets each platform pick
      // a strategy that keeps the label visible.
      images: image ? [{ url: image, alt: imageAlt }] : undefined,
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
  if (!UUID_RE.test(id)) notFound();
  const headersList = await headers();
  const country = headersList.get('x-vercel-ip-country') || headersList.get('x-user-country') || 'KR';

  // JSON-LD Product schema — drives Google's rich snippets (price chip +
  // availability chip + image in SERP). Without this the listing shows
  // only the title + meta description even when the product page is rich.
  // Skip inactive products here too so SERP rich-snippet data doesn't
  // outlive the operator's "비공개" toggle.
  const products = await getProducts();
  const product = products.find(p => p.id === id && p.is_active);
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
          //
          // CRITICAL XSS HARDENING: JSON.stringify does NOT escape `<`,
          // which means an admin-saved product name or description
          // containing `</script><script>alert(1)</script>` breaks out
          // of the JSON-LD block and executes on every viewer's browser.
          // Defang the closing-script-tag sequence by replacing `<` with
          // its Unicode escape — still parses as JSON, no longer parses
          // as the end of the script element.
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(ld).replace(/</g, '\\u003c'),
          }}
        />
      )}
      <ProductDetailPage lang={lang} canPurchase={country === 'KR'} id={id} />
    </>
  );
}
