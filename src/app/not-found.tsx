import type { Metadata } from 'next';
import Link from 'next/link';
import { detectLangServer } from '@/lib/i18n/detectServer';

/**
 * Root `/not-found.tsx` — fires when a URL matches no route AT ALL,
 * including URLs outside the `/[lang]/*` tree (e.g. `/wp-admin`,
 * `/xmlrpc.php`, a stale legacy path, a WordPress-probe scanner). The
 * per-lang `[lang]/not-found.tsx` only covers cases where a child
 * segment inside `/kr/*` or `/en/*` called `notFound()`; without a
 * root handler Next.js falls back to its built-in unbranded 404 chrome
 * with no lang tag and no `robots: noindex`.
 *
 * Round 30: added so bot-scanning URLs return a real branded 404 with
 * `robots.noindex` — prior state let bot-probe paths get indexed
 * as 200-styled unbranded stubs, wasting crawl budget + polluting
 * Google's index.
 *
 * Server component + `detectLangServer` so the response is language-
 * aware for organic 404s from a Korean visitor mistyping a URL.
 */
export const metadata: Metadata = {
  title: 'Page not found',
  robots: { index: false, follow: false },
};

export default async function RootNotFound() {
  const lang = await detectLangServer();
  const isEn = lang === 'en';
  const home = isEn ? '/en' : '/kr';
  const title = isEn ? 'Page not found' : '페이지를 찾을 수 없어요';
  const body = isEn
    ? 'The address may be wrong, or the page may have been removed. Head back home and try again.'
    : '주소가 잘못되었거나 페이지가 삭제되었을 수 있어요. 홈으로 돌아가서 다시 시도해 보세요.';
  const cta = isEn ? 'Back to home' : '홈으로 돌아가기';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-16 text-center bg-white">
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
