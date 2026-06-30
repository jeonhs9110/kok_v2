import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.kokkokgarden.com';

interface SitemapData {
  products: Array<{ id: string; created_at: string }>;
  menus: Array<{ id: string; slug: string; sort_order: number }>;
  pages: Array<{ slug: string; created_at: string }>;
  posts: Array<{ id: string; menu_id: string; updated_at: string }>;
  reviews: Array<{ id: string; updated_at: string }>;
}

async function fetchSitemapData(): Promise<SitemapData | null> {
  if (process.env.USE_RDS === 'true') {
    try {
      const { getSitemapDataFromPg } = await import('@/lib/db/storefront-reads');
      return await getSitemapDataFromPg();
    } catch (err) {
      console.error('[sitemap] pg fetch failed; URLs omitted:', err);
      return null;
    }
  }
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;
  if (!supabase) return null;

  const [productsRes, menusRes, pagesRes, postsRes, reviewsRes] = await Promise.all([
    supabase.from('products').select('id, created_at').eq('is_active', true),
    supabase.from('menus').select('id, slug, sort_order').eq('is_published', true),
    supabase.from('pages').select('slug, created_at').eq('is_published', true),
    supabase.from('posts').select('id, menu_id, updated_at').eq('is_published', true),
    supabase.from('review_cards').select('id, updated_at').eq('is_active', true),
  ]);

  for (const [name, res] of [
    ['products', productsRes], ['menus', menusRes], ['pages', pagesRes],
    ['posts', postsRes], ['reviews', reviewsRes],
  ] as const) {
    if (res.error) {
      console.error(`[sitemap] ${name} query failed; URLs omitted:`, res.error);
    }
  }

  return {
    products: (productsRes.data ?? []) as SitemapData['products'],
    menus: (menusRes.data ?? []) as SitemapData['menus'],
    pages: (pagesRes.data ?? []) as SitemapData['pages'],
    posts: (postsRes.data ?? []) as SitemapData['posts'],
    reviews: (reviewsRes.data ?? []) as SitemapData['reviews'],
  };
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/kr`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/en`, lastModified: new Date(), changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/kr/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/en/products`, lastModified: new Date(), changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/kr/worldwide`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/en/worldwide`, lastModified: new Date(), changeFrequency: 'weekly', priority: 0.7 },
    { url: `${SITE_URL}/kr/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/en/contact`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/kr/support`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/en/support`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/kr/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/kr/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/en/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/en/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];

  const data = await fetchSitemapData();
  if (!data) return staticRoutes;

  const productRoutes = data.products.flatMap(p => [
    { url: `${SITE_URL}/kr/products/${p.id}`, lastModified: new Date(p.created_at), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${SITE_URL}/en/products/${p.id}`, lastModified: new Date(p.created_at), changeFrequency: 'weekly' as const, priority: 0.8 },
  ]);

  const menuRoutes = data.menus.flatMap(m => [
    { url: `${SITE_URL}/kr/menus/${m.slug}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${SITE_URL}/en/menus/${m.slug}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
  ]);

  const pageRoutes = data.pages.flatMap(p => [
    { url: `${SITE_URL}/kr/pages/${p.slug}`, lastModified: new Date(p.created_at), changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${SITE_URL}/en/pages/${p.slug}`, lastModified: new Date(p.created_at), changeFrequency: 'monthly' as const, priority: 0.5 },
  ]);

  const menuSlugById = new Map<string, string>();
  for (const m of data.menus) menuSlugById.set(m.id, m.slug);
  const postRoutes = data.posts.flatMap(p => {
    const menuSlug = menuSlugById.get(p.menu_id);
    if (!menuSlug) return [];
    return [
      { url: `${SITE_URL}/kr/menus/${menuSlug}/${p.id}`, lastModified: new Date(p.updated_at), changeFrequency: 'weekly' as const, priority: 0.5 },
      { url: `${SITE_URL}/en/menus/${menuSlug}/${p.id}`, lastModified: new Date(p.updated_at), changeFrequency: 'weekly' as const, priority: 0.5 },
    ];
  });

  // review_cards each get a /[lang]/reviews/[id] detail page; the
  // landing /[lang]/reviews/ is already in the static list (covered
  // by /menus/review). Enumerating per-card lets Google crawl the
  // long tail of admin-curated reviews instead of stopping at the
  // gallery.
  const reviewRoutes = data.reviews.flatMap(r => [
    { url: `${SITE_URL}/kr/reviews/${r.id}`, lastModified: new Date(r.updated_at), changeFrequency: 'monthly' as const, priority: 0.4 },
    { url: `${SITE_URL}/en/reviews/${r.id}`, lastModified: new Date(r.updated_at), changeFrequency: 'monthly' as const, priority: 0.4 },
  ]);

  return [...staticRoutes, ...productRoutes, ...menuRoutes, ...pageRoutes, ...postRoutes, ...reviewRoutes];
}
