'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Fires a single /api/track POST per route change with the path,
 * referrer, and window.location.search. The search string carries
 * any utm_source / utm_medium / utm_campaign that a campaign tagged
 * onto the landing URL — /api/track parses them into separate
 * columns at write time so the dashboard doesn't have to re-extract.
 */
export default function PageTracker() {
  const pathname = usePathname();

  useEffect(() => {
    fetch('/api/track', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: pathname,
        referrer: document.referrer || null,
        search: window.location.search || null,
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
