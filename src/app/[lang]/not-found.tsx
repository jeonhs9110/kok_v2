import Link from 'next/link';

/**
 * Storefront 404 for /[lang]/* — fires whenever a child segment calls
 * notFound() (e.g. a missing menu slug). Without this Next.js shows the
 * root not-found.tsx which falls back to the bare default and breaks
 * out of the storefront chrome.
 */
export default function StorefrontNotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-[11px] font-bold tracking-[0.25em] text-neutral-400 uppercase mb-3">404</p>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-brand-ink mb-3">
        페이지를 찾을 수 없어요
      </h1>
      <p className="text-sm text-neutral-500 max-w-md mb-8">
        주소가 잘못되었거나 페이지가 삭제되었을 수 있어요. 홈으로 돌아가서 다시 시도해 보세요.
      </p>
      <Link
        href="/kr"
        className="inline-flex items-center bg-brand-ink text-white px-6 py-3 text-xs font-bold tracking-widest uppercase hover:bg-black transition-colors"
      >
        홈으로 돌아가기
      </Link>
    </div>
  );
}
