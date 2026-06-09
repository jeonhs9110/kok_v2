'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';

/**
 * Renders the "← 홈페이지 빌더로 돌아가기" breadcrumb when the current
 * page was navigated to from the hub (`?from=homepage`).
 *
 * Lives in its own client component (not directly in the admin layout)
 * so the parent can drop it inside a <Suspense> boundary. Next.js 16's
 * prerender pass bails out of any page that reads useSearchParams()
 * outside a Suspense — without this wrapper, the entire /admin/* tree
 * fails to build (see: 2026-06-10 PR #128 → #129 hotfix).
 */
export default function BackToHubLink() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (pathname === '/admin/homepage') return null;
  if (searchParams?.get('from') !== 'homepage') return null;
  return (
    <Link
      href="/admin/homepage"
      className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-brand-primary hover:text-brand-ink border border-brand-primary/30 rounded-md hover:bg-brand-primary/5 transition-colors"
    >
      <ArrowLeft className="w-3.5 h-3.5" />
      홈페이지 빌더로 돌아가기
    </Link>
  );
}
