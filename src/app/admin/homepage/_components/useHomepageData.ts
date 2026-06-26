import { useEffect, useState } from 'react';
import { EMPTY_COUNTS, type SectionCounts, type HomepageBanner } from './useHomepageSections';

const DEFAULT_SECTION_ORDER = [
  'carousel', 'promo-banners', 'products', 'shorts', 'sub-hero', 'instagram',
];

/**
 * Three-channel loader for /admin/homepage. Single round trip to
 * /api/admin/homepage-hub (RDS-dispatched). Returns the saved drag-order,
 * the inline banner rows, and the per-section count snapshot for the
 * card sub-labels in one shot.
 */
export function useHomepageData() {
  const [sectionOrder, setSectionOrder] = useState<string[]>(DEFAULT_SECTION_ORDER);
  const [banners, setBanners] = useState<HomepageBanner[]>([]);
  const [counts, setCounts] = useState<SectionCounts>(EMPTY_COUNTS);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/homepage-hub', { cache: 'no-store' });
        if (res.ok) {
          const json = (await res.json()) as {
            sectionOrder: string[] | null;
            banners: HomepageBanner[];
            counts: SectionCounts | null;
          };
          if (json.sectionOrder) setSectionOrder(json.sectionOrder);
          if (json.banners) setBanners(json.banners);
          if (json.counts) setCounts(json.counts);
        }
      } catch (err) {
        console.error('[admin/homepage] hub load failed:', err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  return {
    sectionOrder,
    setSectionOrder,
    banners,
    setBanners,
    counts,
    isLoading,
  };
}
