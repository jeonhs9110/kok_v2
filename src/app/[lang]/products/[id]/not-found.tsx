import Link from 'next/link';

export default function ProductNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-[11px] font-bold tracking-[0.25em] text-neutral-400 uppercase mb-3">404</p>
      <h1 className="text-2xl md:text-3xl font-black tracking-tight text-brand-ink mb-3">
        상품을 찾을 수 없어요
      </h1>
      <p className="text-sm text-neutral-500 max-w-md mb-8">
        품절되었거나 판매가 종료된 상품일 수 있어요. 전체 상품에서 다시 찾아보세요.
      </p>
      <Link
        href="/kr/products"
        className="inline-flex items-center bg-brand-ink text-white px-6 py-3 text-xs font-bold tracking-widest uppercase hover:bg-black transition-colors"
      >
        전체 상품 보기
      </Link>
    </div>
  );
}
