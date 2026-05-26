'use client';

import { useEffect } from 'react';

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

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4 px-4">
      <h2 className="text-lg font-bold text-neutral-900">일시적인 오류가 발생했어요</h2>
      <p className="text-sm text-neutral-500 text-center max-w-md leading-relaxed">
        잠시 후 다시 시도해주세요. 문제가 계속되면 1688-9407로 문의 부탁드립니다.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="bg-black text-white px-6 py-2.5 text-sm font-bold rounded hover:bg-neutral-800 transition-colors"
      >
        다시 시도
      </button>
    </div>
  );
}
