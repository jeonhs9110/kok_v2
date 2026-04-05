import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import ProductActionButtons from '@/components/ProductActionButtons';
import RecentViewTracker from '@/components/RecentViewTracker';
import { getProducts } from '@/lib/api/products';
import { translateProduct } from '@/lib/openai';

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

  const allProducts = await getProducts();
  const productData = allProducts.find(p => p.id === id);

  if (!productData) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
        <p className="text-neutral-500 tracking-widest text-sm">{lb.notFound}</p>
        <Link href={`/${lang}/products`} className="text-xs font-bold tracking-widest underline underline-offset-4 hover:text-black transition-colors">
          ← {lb.shop}
        </Link>
      </div>
    );
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
        <ChevronRight className="w-3 h-3 mx-2" />
        <span className="text-[#111111]">{translated.ingredient || translated.name}</span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 lg:gap-24">
        {/* Product Image */}
        <div className="space-y-4">
          <div className="w-full aspect-[5/6] bg-[#f8f8f8] flex items-center justify-center overflow-hidden">
            {productData.imageUrl ? (
              <img
                src={productData.imageUrl}
                alt={translated.name}
                className="w-full h-full object-cover mix-blend-multiply"
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
          <h1 className="text-3xl lg:text-4xl font-extrabold tracking-tight text-[#111111] mb-4">{translated.name}</h1>
          <p className="text-neutral-500 text-sm font-medium mb-8 leading-relaxed">{translated.summary}</p>

          <div className="flex items-end gap-3 mb-10 pb-8 border-b border-neutral-100">
            {discountPct > 0 && (
              <span className="text-[#f15a24] font-bold text-lg mb-0.5 tracking-tight">{discountPct}%</span>
            )}
            <span className="text-3xl font-extrabold tracking-tight text-[#111111]">
              {productData.price.toLocaleString()}<span className="text-xl font-bold ml-1">원</span>
            </span>
            {productData.originalPrice > productData.price && (
              <span className="text-neutral-400 line-through text-sm font-medium mb-1 ml-1">
                {productData.originalPrice.toLocaleString()}원
              </span>
            )}
          </div>

          {translated.description && (
            <div className="space-y-4 mb-8">
              <h3 className="text-[12px] font-bold tracking-widest text-[#111111]">{lb.details}</h3>
              <p className="text-neutral-600 text-[14px] leading-loose break-keep">{translated.description}</p>
            </div>
          )}

          {canPurchase ? (
            <ProductActionButtons productId={id} productName={productData.name} price={productData.price} originalPrice={productData.originalPrice} imageUrl={productData.imageUrl} naverStoreUrl={productData.naver_store_url} />
          ) : lb.unavailable ? (
            <div className="pt-8 mt-8 border-t border-neutral-100 space-y-4">
              <p className="text-sm text-neutral-500">{lb.unavailable}</p>
              <Link
                href="/kr/kr"
                className="inline-block bg-[#111111] text-white px-6 py-3 text-xs font-bold tracking-widest hover:bg-black transition-colors"
              >
                {lb.visitKr}
              </Link>
            </div>
          ) : null}
        </div>
      </div>

      {/* Detail image area */}
      <div className="mt-24 pt-16 border-t border-neutral-100 text-center">
        <h2 className="text-lg font-extrabold tracking-widest mb-12 uppercase">{lb.detailView}</h2>
        <div className="w-full max-w-3xl mx-auto aspect-video bg-[#f8f8f8] flex items-center justify-center text-neutral-400 text-sm rounded-lg">
          <span className="tracking-widest text-[11px] font-semibold">DETAIL IMAGE AREA</span>
        </div>
      </div>
    </div>
  );
}
