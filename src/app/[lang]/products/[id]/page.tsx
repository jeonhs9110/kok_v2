import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import ProductDetailPage from '@/components/pages/ProductDetailPage';
import { getProductById } from '@/lib/api/products';

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
  //
  // Round 32: switched to `getProductById(id)` — was doing
  // `getProducts().find(p => p.id === id && p.is_active)`, which
  // materialized every product row (including inactive drafts) +
  // every rich column (detail_body, detail_components, seo) just
  // to pick one. `getProductById` returns null on inactive too
  // (mirrors the `.find(... && p.is_active)` predicate), so
  // downstream branches are unchanged.
  let product;
  try {
    product = await getProductById(id);
  } catch (err) {
    console.error('[products/[id]] generateMetadata getProductById threw', err);
    return {};
  }
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
        'ko-KR': `https://www.kokkokgarden.com/kr/products/${id}`,
        'en-US': `https://www.kokkokgarden.com/en/products/${id}`,
        'x-default': `https://www.kokkokgarden.com/en/products/${id}`,
      },
    },
    openGraph: {
      title,
      description: desc,
      url,
      type: 'website',
      // Round 30: emit explicit width/height (1:1, 1200x1200). Prior
      // "let scrapers auto-detect" comment left Kakao's SEO validator
      // flagging every product with "og:image 크기 미지정" and Kakao
      // fell back to the small compact-card layout that hides the
      // product hero. Since KakaoTalk is the primary sharing channel
      // for the KR customer base, that was killing share-driven CTR.
      // Facebook/LinkedIn center-crop 1:1 into their 1.91:1 card but
      // keep the label visible; the small-card downgrade on Kakao is
      // the bigger loss.
      images: image ? [{ url: image, alt: imageAlt, width: 1200, height: 1200 }] : undefined,
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
  // Round 30: cloudfront-viewer-country (trusted edge) instead of
  // client-spoofable x-vercel-ip-country. Same fix as [lang]/page.tsx
  // and [lang]/products/page.tsx.
  const country = headersList.get('cloudfront-viewer-country') || headersList.get('x-user-country') || 'KR';

  // JSON-LD Product schema — drives Google's rich snippets (price chip +
  // availability chip + image in SERP). Without this the listing shows
  // only the title + meta description even when the product page is rich.
  // Skip inactive products here too so SERP rich-snippet data doesn't
  // outlive the operator's "비공개" toggle.
  // Round 32: same helper as generateMetadata above — single-row fetch
  // instead of the previous full-table `.find(...)`.
  const product = await getProductById(id);
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
          // Round 30: `priceValidUntil` is now a required field on
          // schema.org Offer when `price` is set. Without it Google
          // Search Console flags every product page as "Missing
          // field 'priceValidUntil'" and demotes the rich result
          // to a basic snippet, losing the price + availability
          // chip in SERP (~15-25% CTR uplift). No promo end date
          // in the DB today, so use request-time + 30 days as a
          // conservative rolling window — the price the crawler
          // captured is guaranteed valid for at least that long.
          // Server component (RSC) so Date.now() at render is safe
          // to compute per-request; the react-hooks/purity lint is
          // client-render-oriented and doesn't distinguish RSC vs
          // client components.
          // eslint-disable-next-line react-hooks/purity
          priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
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
