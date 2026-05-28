'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * Route-level error boundary for everything outside `app/[lang]/`.
 *
 * The auth/cart server-component lift (PR #62) created a class of new
 * failure modes: any throw inside `detectLangServer()`, the header data
 * fetch, or the page body now bubbles up as an unhandled exception that
 * Next.js otherwise renders as a blank white page (in prod) or the dev
 * overlay (in dev). Removing fail-silent fallbacks (PR #47) made these
 * exceptions louder — which is correct for data integrity, but bad for
 * UX without a catch.
 *
 * This file catches anything thrown under `app/*` that doesn't have a
 * more specific `error.tsx` already (the existing one under `[lang]/`
 * keeps its own version for the storefront chrome).
 */
export default function RootRouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // CloudWatch picks up systemd journal stderr, so this surfaces under
    // /aws/ec2/.../journald with the [route-error] prefix for grep.
    console.error('[route-error]', error.message, error.digest, error.stack);
  }, [error]);

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-white px-6 text-center">
      <div className="max-w-md space-y-5">
        <h1 className="text-xl font-bold text-[#111]">
          일시적인 오류가 발생했어요
        </h1>
        <p className="text-sm text-neutral-500 leading-relaxed">
          잠시 후 다시 시도해주세요.
          <br />
          문제가 계속되면 새로고침하시거나 다른 페이지로 이동해주세요.
        </p>
        <div className="flex gap-2 justify-center pt-2">
          <button
            type="button"
            onClick={() => reset()}
            className="bg-[#111] text-white px-6 py-2.5 text-sm font-bold tracking-wider hover:bg-black transition-colors"
          >
            다시 시도
          </button>
          <Link
            href="/"
            className="border border-neutral-200 text-neutral-600 px-6 py-2.5 text-sm font-semibold hover:bg-neutral-50 transition-colors"
          >
            홈으로
          </Link>
        </div>
        {error.digest && (
          <p className="text-[10px] text-neutral-300 font-mono pt-4">
            error id: {error.digest}
          </p>
        )}
      </div>
    </div>
  );
}
