'use client';

import { useSearchParams } from 'next/navigation';

/**
 * EmbeddedShell — when an admin route is loaded inside the
 * /admin/homepage builder's slide-in drawer (via `?embedded=true`),
 * we strip the global sidebar + header so the editor renders flush
 * inside the drawer pane. Falls through to the regular chrome when
 * the query is absent.
 *
 * Lives in its own client component so the parent layout can wrap it
 * in Suspense — useSearchParams() outside a Suspense bails out of
 * Next.js 16's prerender pass, the same trap that took down PR #128.
 */
export default function EmbeddedShell({
  children, fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const sp = useSearchParams();
  if (sp?.get('embedded') === 'true') {
    return (
      <div className="min-h-screen bg-white overflow-x-hidden">
        {children}
      </div>
    );
  }
  return <>{fallback}</>;
}
