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
    { url: `${SITE_URL}/kr/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/kr/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/en/terms`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
    { url: `${SITE_URL}/en/privacy`, lastModified: new Date(), changeFrequency: 'monthly', priority: 0.3 },
  ];

  let productRoutes: MetadataRoute.Sitemap = [];
  if (supabase) {
    try {
      const { data } = await supabase.from('products').select('id, created_at').eq('is_active', true);
      if (data) {
        productRoutes = data.flatMap(p => [
          { url: `${SITE_URL}/kr/products/${p.id}`, lastModified: new Date(p.created_at), changeFrequency: 'weekly' as const, priority: 0.8 },
          { url: `${SITE_URL}/en/products/${p.id}`, lastModified: new Date(p.created_at), changeFrequency: 'weekly' as const, priority: 0.8 },
        ]);
      }
    } catch { /* skip if DB fails */ }
  }

  return [...staticRoutes, ...productRoutes];
}
