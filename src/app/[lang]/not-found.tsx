'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

/**
 * Storefront 404 for /[lang]/* — fires whenever a child segment calls
 * notFound() (e.g. a missing menu slug). Without this Next.js shows the
 * root not-found.tsx which falls back to the bare default and breaks
 * out of the storefront chrome.
 *
 * Next.js does NOT pass route params to not-found.tsx, so we read the
 * locale off the pathname directly. Falls back to `kr` for any unknown
 * shape so the link never points to a literal 404 path.
 */
export default function StorefrontNotFound() {
  const pathname = usePathname() ?? '';
  const lang = pathname.startsWith('/en') ? 'en' : 'kr';
  const home = `/${lang}`;
  const title = lang === 'en' ? 'Page not found' : '페이지를 찾을 수 없어요';
  const body = lang === 'en'
    ? 'The address may be wrong, or the page may have been removed. Head back home and try again.'
    : '주소가 잘못되었거나 페이지가 삭제되었을 수 있어요. 홈으로 돌아가서 다시 시도해 보세요.';
  const cta = lang === 'en' ? 'Back to home' : '홈으로 돌아가기';

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-[11px] font-bold tracking-[0.25em] text-neutral-400 uppercase mb-3">404</p>
      <h1 className="text-3xl md:text-4xl font-black tracking-tight text-brand-ink mb-3">
        {title}
      </h1>
      <p className="text-sm text-neutral-500 max-w-md mb-8">{body}</p>
      <Link
        href={home}
        className="inline-flex items-center bg-brand-ink text-white px-6 py-3 text-xs font-bold tracking-widest uppercase hover:bg-black transition-colors"
      >
        {cta}
      </Link>
    </div>
  );
}
