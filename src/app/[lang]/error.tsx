'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Storefront error boundary for /[lang]/*. Triggered when an
 * unrecoverable render error bubbles up from a child route. Next.js
 * does not pass route params here, so we derive the locale from the
 * pathname directly (same trick the not-found pages use). Defaults to
 * Korean for any unknown shape since /kr is the canonical storefront.
 */
export default function LangError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Storefront error:', error);
  }, [error]);

  const pathname = usePathname() ?? '';
  const lang = pathname.startsWith('/en') ? 'en' : 'kr';
  const title = lang === 'en'
    ? 'A temporary error occurred'
    : '일시적인 오류가 발생했어요';
  const body = lang === 'en'
    ? 'Please try again in a moment. If the problem persists, contact us at 1688-9407.'
    : '잠시 후 다시 시도해주세요. 문제가 계속되면 1688-9407로 문의 부탁드립니다.';
  const cta = lang === 'en' ? 'Try again' : '다시 시도';

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
      <h2 className="text-lg font-bold text-neutral-900">{title}</h2>
      <p className="text-sm text-neutral-500 text-center max-w-md leading-relaxed">
        {body}
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="bg-black text-white px-6 py-2.5 text-sm font-bold rounded hover:bg-neutral-800 transition-colors"
      >
        {cta}
      </button>
    </div>
  );
}
