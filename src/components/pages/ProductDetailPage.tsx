import Link from 'next/link';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { ChevronRight } from 'lucide-react';
import ProductActionButtons from '@/components/ProductActionButtons';
import KakaoShareButton from '@/components/KakaoShareButton';
import ProductReviewSection from '@/components/ProductReviewSection';
import RecentViewTracker from '@/components/RecentViewTracker';
import { getProducts } from '@/lib/api/products';
import { getAllCategories } from '@/lib/api/categories';
import { translateProduct } from '@/lib/openai';
import ProductDetailComponents from '@/components/ProductDetailComponents';
import { sanitizeHtml } from '@/lib/html/sanitizeHtml';

const labels: Record<string, {
  home: string; shop: string; details: string; notFound: string;
  detailView: string; unavailable: string; visitKr: string;
}> = {
  kr: { home: '홈', shop: '상품', details: '상품 상세', notFound: '상품을 찾을 수 없습니다', detailView: '상품 상세', unavailable: '', visitKr: '' },
  en: { home: 'HOME', shop: 'SHOP', details: 'PRODUCT DETAILS', notFound: 'PRODUCT NOT FOUND', detailView: 'DETAIL VIEW', unavailable: 'This product is available for purchase in South Korea only.', visitKr: 'Visit Korean Store →' },
};

interface Props {
  lang: string;
  canPurchase: boolean;
  id: string;
}

export default async function ProductDetailPage({ lang, canPurchase, id }: Props) {
  const lb = labels[lang] ?? labels['en'];

  const [allProducts, allCategories] = await Promise.all([
    getProducts(),
    getAllCategories(),
  ]);
  // 2026-06-29: filter out inactive products. getProducts() returns the
  // full catalog (including is_active=false rows) so admin-side views
  // can list them; the storefront detail page was using the same source
  // without filtering, meaning admin's "비공개" toggle didn't actually
  // hide the page. A customer with a bookmarked / shared / cached URL
  // could still load the detail page for a discontinued product and
  // try to add it to cart. /products list page already filters this
  // way; bringing the detail page to parity.
  const productData = allProducts.find(p => p.id === id && p.is_active);

  if (!productData) {
    // Delegate to src/app/[lang]/products/[id]/not-found.tsx — that
    // route has the branded 404 chrome + "browse all products" CTA
    // AND returns HTTP 404 instead of 200. Prior inline render was
    // returning 200 for missing products, which meant Google was
    // indexing the "not found" body and Kakao previews rendered a
    // "product page" card for stale links.
    notFound();
  }

  // Auto-translate product fields with GPT-4o mini for non-Korean languages.
  // Falls back to original Korean if API key missing or call fails.
  const translated = lang !== 'kr'
    ? await translateProduct(
        productData.id,
        lang,
        productData.name,
        productData.summary,
        productData.description,
        productData.ingredient
      )
    : {
        name:        productData.name,
        summary:     productData.summary,
        description: productData.description,
        ingredient:  productData.ingredient,
      };

  const categoryName = (() => {
    const c = allCategories.find(c => c.id === productData.category_id);
    return c ? (c.name?.[lang] || c.name?.en || c.name?.kr || '') : '';
  })();
  const subcategoryName = (() => {
    const c = allCategories.find(c => c.id === productData.subcategory_id);
    return c ? (c.name?.[lang] || c.name?.en || c.name?.kr || '') : '';
  })();

  const discountPct = productData.originalPrice > productData.price
    ? Math.round((productData.originalPrice - productData.price) / productData.originalPrice * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 md:py-16 animate-in fade-in duration-500 bg-white">
      <RecentViewTracker productId={id} name={productData.name} price={productData.price} originalPrice={productData.originalPrice} imageUrl={productData.imageUrl} />
      {/* Breadcrumb */}
      <div className="flex items-center text-[11px] font-semibold text-neutral-400 mb-10 tracking-widest flex-wrap gap-y-1">
        <Link href={`/${lang}`} className="hover:text-black transition-colors">{lb.home}</Link>
        <ChevronRight className="w-3 h-3 mx-2" />
        <Link href={`/${lang}/products`} className="hover:text-black transition-colors">{lb.shop}</Link>
        {categoryName && (
          <>
            <ChevronRight className="w-3 h-3 mx-2" />
            <span className="text-brand-ink">{categoryName}</span>
          </>
        )}
        {subcategoryName && (
          <>
            <ChevronRight className="w-3 h-3 mx-2" />
            <span className="text-brand-ink">{subcategoryName}</span>
          </>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
        {/* Product Image */}
        <div className="space-y-4">
          <div className="relative w-full aspect-[5/6] bg-[#f8f8f8] flex items-center justify-center overflow-hidden">
            {productData.imageUrl ? (
              <Image
                src={productData.imageUrl}
                alt={translated.name}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                priority
                className="object-cover mix-blend-multiply"
              />
            ) : (
              <div className="text-neutral-300 text-sm tracking-widest">NO IMAGE</div>
            )}
          </div>
        </div>

        {/* Product Info */}
        <div className="flex flex-col pt-4">
          {translated.ingredient && (
            <p className="text-[11px] font-bold tracking-widest text-neutral-400 mb-3 uppercase">{translated.ingredient}</p>
          )}
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-brand-ink mb-4">{translated.name}</h1>
          <p className="text-neutral-500 text-sm font-medium mb-6 leading-relaxed">{translated.summary}</p>

          <div className="flex items-end gap-3 mb-10 pb-8 border-b border-neutral-100">
            {discountPct > 0 && (
              <span className="text-[#f15a24] font-bold text-lg mb-0.5 tracking-tight">{discountPct}%</span>
            )}
            <span className="text-3xl font-extrabold tracking-tight text-brand-ink">
              {lang === 'kr' ? (
                <>{productData.price.toLocaleString()}<span className="text-xl font-bold ml-1">원</span></>
              ) : (
                <><span className="text-xl font-bold mr-1">KRW</span>{productData.price.toLocaleString()}</>
              )}
            </span>
            {productData.originalPrice > productData.price && (
              <span className="text-neutral-400 line-through text-sm font-medium mb-1 ml-1">
                {lang === 'kr' ? `${productData.originalPrice.toLocaleString()}원` : `KRW ${productData.originalPrice.toLocaleString()}`}
              </span>
            )}
          </div>

          {translated.description && (
            <div className="space-y-4 mb-8">
              <h3 className="text-[12px] font-bold tracking-widest text-brand-ink">{lb.details}</h3>
              <p className="text-neutral-600 text-[14px] leading-loose break-keep">{translated.description}</p>
            </div>
          )}

          {canPurchase ? (
            <>
              <ProductActionButtons productId={id} productName={productData.name} price={productData.price} originalPrice={productData.originalPrice} imageUrl={productData.imageUrl} naverStoreUrl={productData.naver_store_url} showCartButton={productData.show_cart_button} showBuyButton={productData.show_buy_button} />
              {/* KakaoTalk share — Korea's dominant messaging app. Prior
                  to Round 23 there was NO share button anywhere on the
                  storefront, so a customer who wanted to send a product
                  to a KakaoTalk friend had to long-press the URL and
                  copy-paste — the single largest KR social-share loss
                  surface on the site. URL-based sharer keeps the JS
                  bundle unaffected. */}
              <div className="mt-4 flex justify-start">
                <KakaoShareButton
                  url={`https://www.kokkokgarden.com/${lang}/products/${id}`}
                  title={translated.name}
                  description={translated.summary || translated.description || undefined}
                  imageUrl={productData.imageUrl || undefined}
                  lang={lang}
                />
              </div>
            </>
          ) : lb.unavailable ? (
            <div className="pt-8 mt-8 border-t border-neutral-100 space-y-4">
              <p className="text-sm text-neutral-500">{lb.unavailable}</p>
              <Link
                href="/kr"
                className="inline-block bg-brand-ink text-white px-6 py-3 text-xs font-bold tracking-widest hover:bg-black transition-colors"
              >
                {lb.visitKr}
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {productData.detailComponents && productData.detailComponents.length > 0 ? (
        <div className="mt-24 pt-16 border-t border-neutral-100">
          <h2 className="text-lg font-extrabold tracking-widest mb-12 uppercase text-center">{lb.detailView}</h2>
          <div className="max-w-3xl mx-auto">
            <ProductDetailComponents components={productData.detailComponents} />
          </div>
        </div>
      ) : productData.detailBody ? (
        <div className="mt-24 pt-16 border-t border-neutral-100">
          <h2 className="text-lg font-extrabold tracking-widest mb-12 uppercase text-center">{lb.detailView}</h2>
          <div
            className="detail-body max-w-3xl mx-auto"
            // 2026-06-29: defense-in-depth — same rationale as PageBlocks.
            // Admin-authored via RichEditor, but stripping <script> +
            // inline event handlers protects against compromised admin
            // accounts AND keeps every dangerouslySetInnerHTML site on
            // the storefront behind the same sanitizer.
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(productData.detailBody) }}
          />
        </div>
      ) : (
        <div className="mt-24 pt-16 border-t border-neutral-100 text-center">
          <h2 className="text-lg font-extrabold tracking-widest mb-12 uppercase">{lb.detailView}</h2>
          <div className="w-full max-w-3xl mx-auto aspect-video bg-[#f8f8f8] flex items-center justify-center text-neutral-400 text-sm rounded-lg">
            <span className="tracking-widest text-[11px] font-semibold">DETAIL IMAGE AREA</span>
          </div>
        </div>
      )}

      {/* User reviews — separate area from board posts */}
      <ProductReviewSection productId={id} lang={lang} />
    </div>
  );
}
