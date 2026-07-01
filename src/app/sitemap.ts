import type { MetadataRoute } from 'next';
import { unstable_cache } from 'next/cache';

const SITE_URL = 'https://www.kokkokgarden.com';

// Force server-rendered per request. Without this, Next.js prerenders
// the sitemap at build time — and the GHA build container has no
// DATABASE_URL, so fetchSitemapData() throws and only the 14 static
// routes ship in the baked sitemap.xml. Every product / menu / page /
// post / review page would be invisible to Google's crawler.
//
// The dynamic render is cheap thanks to `cachedFetchSitemapData` below
// (in-process unstable_cache, 1-hour TTL with tag invalidation on
// product/menu/page/post saves). Sitemap requests are rare (Googlebot
// every few days) but Bing / Naver / random crawlers can hit it more
// frequently, and the underlying pg fan-out is 5 full-table SELECTs —
// caching the parsed result drops each hit to ~0.5ms.
export const dynamic = 'force-dynamic';

interface SitemapData {
  products: Array<{ id: string; created_at: string }>;
  menus: Array<{ id: string; slug: string; sort_order: number }>;
  pages: Array<{ slug: string; created_at: string }>;
  posts: Array<{ id: string; menu_id: string; updated_at: string }>;
  reviews: Array<{ id: string; updated_at: string }>;
}

const fetchSitemapDataCached = unstable_cache(
  async (): Promise<SitemapData | null> => {
    try {
      const { getSitemapDataFromPg } = await import('@/lib/db/storefront-reads');
      return await getSitemapDataFromPg();
    } catch (err) {
      console.error('[sitemap] pg fetch failed; URLs omitted:', err);
      return null;
    }
  },
  ['sitemap-fan-out'],
  // 1-hour TTL is generous for crawl cadence; admin saves on
  // products / menus / pages / posts / reviews all evict via the
  // tag list below, so operator changes are reflected on the next
  // crawler hit instead of waiting an hour.
  //
  // Tag names MUST match the HomepageTag union in lib/cache/invalidate.ts.
  // Prior to Round 19 this list included 'review_cards' (a table name),
  // but the invalidate helper only emits 'reviews' — so every review
  // edit left the sitemap stale until the natural 1h TTL rolled.
  { revalidate: 3600, tags: ['products', 'menus', 'pages', 'posts', 'reviews', 'homepage'] },
);

// Post-cutover this is a thin wrapper around the RDS-backed cache.
// Round 22 removed the Supabase fallback branch (35 LOC) since
// USE_RDS has been the live path since 2026-06-27 and the Supabase
// project is on its way out. If the RDS read genuinely fails, the
// cache returns null and the caller ships the 14 static routes only —
// same fallback semantics as before, minus the dead code path.
async function fetchSitemapData(): Promise<SitemapData | null> {
  return fetchSitemapDataCached();
}

/**
 * Round 30: emit each URL ONCE with `alternates.languages` cross-refs
 * instead of duplicating every path across `/kr` and `/en`. Google's
 * hreflang-in-sitemap spec requires this shape — the prior "one row
 * per (path, lang)" layout with no cross-refs meant /kr and /en of
 * the same page competed as duplicate content in Google's index.
 * Naver's daily crawl report flagged the same. Also cuts sitemap
 * size by ~50%.
 *
 * `x-default` intentionally points at the /en variant so non-KR-non-EN
 * locales (jp, zh, es, ...) land on English rather than Korean.
 */
type MetaRow = MetadataRoute.Sitemap[number];
function bilingualEntry(
  krPath: string,
  enPath: string,
  extra: Partial<Omit<MetaRow, 'url' | 'alternates'>>,
): MetaRow {
  return {
    url: `${SITE_URL}${krPath}`,
    alternates: {
      languages: {
        'ko-KR': `${SITE_URL}${krPath}`,
        'en-US': `${SITE_URL}${enPath}`,
        'x-default': `${SITE_URL}${enPath}`,
      },
    },
    ...extra,
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticRoutes: MetadataRoute.Sitemap = [
    bilingualEntry('/kr', '/en', { lastModified: now, changeFrequency: 'daily', priority: 1 }),
    bilingualEntry('/kr/products', '/en/products', { lastModified: now, changeFrequency: 'daily', priority: 0.9 }),
    bilingualEntry('/kr/worldwide', '/en/worldwide', { lastModified: now, changeFrequency: 'weekly', priority: 0.7 }),
    bilingualEntry('/kr/contact', '/en/contact', { lastModified: now, changeFrequency: 'monthly', priority: 0.5 }),
    bilingualEntry('/kr/support', '/en/support', { lastModified: now, changeFrequency: 'monthly', priority: 0.5 }),
    bilingualEntry('/kr/terms', '/en/terms', { lastModified: now, changeFrequency: 'monthly', priority: 0.3 }),
    bilingualEntry('/kr/privacy', '/en/privacy', { lastModified: now, changeFrequency: 'monthly', priority: 0.3 }),
  ];

  const data = await fetchSitemapData();
  if (!data) return staticRoutes;

  const productRoutes = data.products.map(p => bilingualEntry(
    `/kr/products/${p.id}`,
    `/en/products/${p.id}`,
    { lastModified: new Date(p.created_at), changeFrequency: 'weekly', priority: 0.8 },
  ));

  const menuRoutes = data.menus.map(m => bilingualEntry(
    `/kr/menus/${m.slug}`,
    `/en/menus/${m.slug}`,
    { lastModified: now, changeFrequency: 'weekly', priority: 0.6 },
  ));

  const pageRoutes = data.pages.map(p => bilingualEntry(
    `/kr/pages/${p.slug}`,
    `/en/pages/${p.slug}`,
    { lastModified: new Date(p.created_at), changeFrequency: 'monthly', priority: 0.5 },
  ));

  const menuSlugById = new Map<string, string>();
  for (const m of data.menus) menuSlugById.set(m.id, m.slug);
  const postRoutes = data.posts.flatMap(p => {
    const menuSlug = menuSlugById.get(p.menu_id);
    if (!menuSlug) return [];
    return [bilingualEntry(
      `/kr/menus/${menuSlug}/${p.id}`,
      `/en/menus/${menuSlug}/${p.id}`,
      { lastModified: new Date(p.updated_at), changeFrequency: 'weekly', priority: 0.5 },
    )];
  });

  // review_cards each get a /[lang]/reviews/[id] detail page; the
  // landing /[lang]/reviews/ is already in the static list (covered
  // by /menus/review). Enumerating per-card lets Google crawl the
  // long tail of admin-curated reviews instead of stopping at the
  // gallery.
  const reviewRoutes = data.reviews.map(r => bilingualEntry(
    `/kr/reviews/${r.id}`,
    `/en/reviews/${r.id}`,
    { lastModified: new Date(r.updated_at), changeFrequency: 'monthly', priority: 0.4 },
  ));

  return [...staticRoutes, ...productRoutes, ...menuRoutes, ...pageRoutes, ...postRoutes, ...reviewRoutes];
}
