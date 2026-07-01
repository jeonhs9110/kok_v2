import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface HubData {
  sectionOrder: string[] | null;
  banners: Array<{ id: string; text: string; bg_color: string; text_color: string; is_active: boolean }>;
  counts: {
    carouselTotal: number; carouselActive: number;
    promoBannersTotal: number; promoBannersActive: number;
    productsTotal: number; productsActive: number;
    shortsTotal: number;
    subHeroTotal: number; subHeroActive: number;
    instagramHandle: string | null;
    instagramPosts: number;
    reviewsTotal: number; reviewsActive: number;
  };
}

/**
 * GET /api/admin/homepage-hub → { sectionOrder, banners, counts }
 * Single aggregated snapshot for /admin/homepage's hub cards. Same
 * shape as the dashboard route's RDS dispatcher pattern.
 */
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      // Round 32: collapsed the 15-parallel-query fan-out into 9. Prior
      // state fired 15 `pool.query` calls in parallel and the pool max
      // is 10 — a single admin loading /admin/homepage would acquire
      // every slot, queue the remaining 5, and effectively serialize
      // the entire site (customers + /api/health + any other admin
      // action) behind one dashboard load. The (total, active) pairs
      // per table now share one COUNT(*) FILTER scan instead of two
      // sequential ones.
      const [
        sectionOrderRow, bannersRows,
        carouselCounts, promoCounts, productsCounts,
        shorts,
        subHeroCounts,
        igConfig, igPosts, reviewsCounts,
      ] = await Promise.all([
        pool.query<{ value: string }>(`SELECT value FROM public.site_settings WHERE key = 'homepage_section_order' LIMIT 1`),
        pool.query<HubData['banners'][number]>(`SELECT id, text, bg_color, text_color, is_active FROM public.homepage_banners`),
        pool.query<{ total: string; active: string }>(`SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE is_active)::text AS active FROM public.carousel_slides`),
        pool.query<{ total: string; active: string }>(`SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE is_active)::text AS active FROM public.promo_banners`),
        pool.query<{ total: string; active: string }>(`SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE is_active)::text AS active FROM public.products`),
        pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM public.shorts`),
        pool.query<{ total: string; active: string }>(`SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE is_active)::text AS active FROM public.sub_hero_banners`),
        pool.query<{ handle: string }>(`SELECT handle FROM public.instagram_config LIMIT 1`),
        pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM public.instagram_posts WHERE is_active = true`),
        pool.query<{ total: string; active: string }>(`SELECT COUNT(*)::text AS total, COUNT(*) FILTER (WHERE is_active)::text AS active FROM public.review_cards`),
      ]);

      let sectionOrder: string[] | null = null;
      const orderRaw = sectionOrderRow.rows[0]?.value;
      if (orderRaw) {
        try {
          const parsed = typeof orderRaw === 'string' ? JSON.parse(orderRaw) : orderRaw;
          if (Array.isArray(parsed) && parsed.every((k: unknown) => typeof k === 'string')) {
            sectionOrder = parsed as string[];
          }
        } catch { /* keep null */ }
      }

      return NextResponse.json({
        sectionOrder,
        banners: bannersRows.rows,
        counts: {
          carouselTotal:      Number(carouselCounts.rows[0]?.total ?? 0),
          carouselActive:     Number(carouselCounts.rows[0]?.active ?? 0),
          promoBannersTotal:  Number(promoCounts.rows[0]?.total ?? 0),
          promoBannersActive: Number(promoCounts.rows[0]?.active ?? 0),
          productsTotal:      Number(productsCounts.rows[0]?.total ?? 0),
          productsActive:     Number(productsCounts.rows[0]?.active ?? 0),
          shortsTotal:        Number(shorts.rows[0]?.n ?? 0),
          subHeroTotal:       Number(subHeroCounts.rows[0]?.total ?? 0),
          subHeroActive:      Number(subHeroCounts.rows[0]?.active ?? 0),
          instagramHandle:    igConfig.rows[0]?.handle ?? null,
          instagramPosts:     Number(igPosts.rows[0]?.n ?? 0),
          reviewsTotal:       Number(reviewsCounts.rows[0]?.total ?? 0),
          reviewsActive:      Number(reviewsCounts.rows[0]?.active ?? 0),
        },
      });
    } catch (err) {
      console.error('[admin/homepage-hub] pg fetch failed:', err);
      return NextResponse.json({ sectionOrder: null, banners: [], counts: null }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ sectionOrder: null, banners: [], counts: null }, { status: 500 });
  const [
    sectionOrderRow, bannersRes,
    carouselAll, carouselActive,
    promoAll, promoActive,
    productsAll, productsActive,
    shorts,
    subHeroAll, subHeroActive,
    igConfig, igPosts,
    reviewsAll, reviewsActive,
  ] = await Promise.all([
    supabase.from('site_settings').select('value').eq('key', 'homepage_section_order').maybeSingle(),
    supabase.from('homepage_banners').select('id,text,bg_color,text_color,is_active'),
    supabase.from('carousel_slides').select('id', { count: 'exact', head: true }),
    supabase.from('carousel_slides').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('promo_banners').select('id', { count: 'exact', head: true }),
    supabase.from('promo_banners').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('products').select('id', { count: 'exact', head: true }),
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('shorts').select('id', { count: 'exact', head: true }),
    supabase.from('sub_hero_banners').select('id', { count: 'exact', head: true }),
    supabase.from('sub_hero_banners').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('instagram_config').select('handle').maybeSingle(),
    supabase.from('instagram_posts').select('id', { count: 'exact', head: true }).eq('is_active', true),
    supabase.from('review_cards').select('id', { count: 'exact', head: true }),
    supabase.from('review_cards').select('id', { count: 'exact', head: true }).eq('is_active', true),
  ]);

  let sectionOrder: string[] | null = null;
  const orderRaw = sectionOrderRow.data?.value;
  if (orderRaw) {
    try {
      const parsed = typeof orderRaw === 'string' ? JSON.parse(orderRaw) : orderRaw;
      if (Array.isArray(parsed) && parsed.every((k: unknown) => typeof k === 'string')) {
        sectionOrder = parsed as string[];
      }
    } catch { /* keep null */ }
  }

  return NextResponse.json({
    sectionOrder,
    banners: (bannersRes.data ?? []) as HubData['banners'],
    counts: {
      carouselTotal:      carouselAll.count ?? 0,
      carouselActive:     carouselActive.count ?? 0,
      promoBannersTotal:  promoAll.count ?? 0,
      promoBannersActive: promoActive.count ?? 0,
      productsTotal:      productsAll.count ?? 0,
      productsActive:     productsActive.count ?? 0,
      shortsTotal:        shorts.count ?? 0,
      subHeroTotal:       subHeroAll.count ?? 0,
      subHeroActive:      subHeroActive.count ?? 0,
      instagramHandle:    (igConfig.data as { handle: string } | null)?.handle ?? null,
      instagramPosts:     igPosts.count ?? 0,
      reviewsTotal:       reviewsAll.count ?? 0,
      reviewsActive:      reviewsActive.count ?? 0,
    },
  });
}
