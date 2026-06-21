import type { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = 'https://www.kokkokgarden.com';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';
  const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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

  if (!supabase) return staticRoutes;

  // All Supabase-backed routes are pulled in parallel so the sitemap build
  // stays bounded — Next.js calls this on each crawl and the page-/menu-/
  // post-driven URLs need to be discoverable for Naver / Google indexing
  // (operator just configured Naver Search Advisor on 2026-06-05).
  const [productsRes, menusRes, pagesRes, postsRes] = await Promise.all([
    supabase.from('products').select('id, created_at').eq('is_active', true),
    supabase.from('menus').select('slug, sort_order').eq('is_published', true),
    supabase.from('pages').select('slug, created_at').eq('is_published', true),
    supabase.from('posts').select('id, menu_id, updated_at').eq('is_published', true),
  ]);

  const productRoutes = (productsRes.data ?? []).flatMap(p => [
    { url: `${SITE_URL}/kr/products/${p.id}`, lastModified: new Date(p.created_at), changeFrequency: 'weekly' as const, priority: 0.8 },
    { url: `${SITE_URL}/en/products/${p.id}`, lastModified: new Date(p.created_at), changeFrequency: 'weekly' as const, priority: 0.8 },
  ]);

  const menuRoutes = (menusRes.data ?? []).flatMap(m => [
    { url: `${SITE_URL}/kr/menus/${m.slug}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
    { url: `${SITE_URL}/en/menus/${m.slug}`, lastModified: new Date(), changeFrequency: 'weekly' as const, priority: 0.6 },
  ]);

  const pageRoutes = (pagesRes.data ?? []).flatMap(p => [
    { url: `${SITE_URL}/kr/pages/${p.slug}`, lastModified: new Date(p.created_at), changeFrequency: 'monthly' as const, priority: 0.5 },
    { url: `${SITE_URL}/en/pages/${p.slug}`, lastModified: new Date(p.created_at), changeFrequency: 'monthly' as const, priority: 0.5 },
  ]);

  // Posts need their parent menu's slug to build the URL. Fan out one
  // extra query for the id↔slug map only if at least one post exists —
  // the menusRes select above only pulled slug+sort_order, so we need id
  // here too. The extra round-trip is cheap and skipped on boards that
  // have no posts (the common state at launch).
  let postRoutes: MetadataRoute.Sitemap = [];
  if ((postsRes.data ?? []).length > 0) {
    const menuSlugById = new Map<string, string>();
    const { data: menuIdSlug } = await supabase.from('menus').select('id, slug').eq('is_published', true);
    for (const m of menuIdSlug ?? []) menuSlugById.set(m.id, m.slug);
    postRoutes = (postsRes.data ?? []).flatMap(p => {
      const menuSlug = menuSlugById.get(p.menu_id);
      if (!menuSlug) return [];
      return [
        { url: `${SITE_URL}/kr/menus/${menuSlug}/${p.id}`, lastModified: new Date(p.updated_at), changeFrequency: 'weekly' as const, priority: 0.5 },
        { url: `${SITE_URL}/en/menus/${menuSlug}/${p.id}`, lastModified: new Date(p.updated_at), changeFrequency: 'weekly' as const, priority: 0.5 },
      ];
    });
  }

  return [...staticRoutes, ...productRoutes, ...menuRoutes, ...pageRoutes, ...postRoutes];
}
