import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * GET /api/admin/asset-usage?url=<public-asset-url>
 *
 * Returns the per-table count of rows that reference the given asset
 * URL, so the admin asset-library can show "this image is still in
 * use" before letting an operator delete. Covers the 10 surfaces the
 * audit on 2026-06-21 identified:
 *
 *   - products.images (text[])
 *   - sub_hero_banners.image_url
 *   - carousel_slides.image_url
 *   - promo_banners.image_url
 *   - review_cards.image_url
 *   - instagram_posts.image_url
 *   - products.detail_body (rich-text HTML; substring match)
 *   - products.detail_components (jsonb array; cast to text)
 *   - menus.content (jsonb LangMap; cast to text)
 *   - pages.blocks (jsonb block array; cast to text)
 *
 * 2026-06-29: previously this work happened CLIENT-SIDE in
 * src/app/admin/assets/_lib.ts via direct Supabase queries. After the
 * 2026-06-27 decommission, every query returned no rows — so the
 * confirm modal always said "no references found" even when the image
 * was live on the storefront. Operators have been deleting in-use
 * images with that false safety signal for 3 days.
 */
interface UsageHit {
  table: string;
  /** Operator-friendly label for the table. */
  label: string;
  /** Up to 3 row-summary strings to surface in the confirm modal. */
  examples: string[];
  count: number;
}

export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(req.url).searchParams.get('url')?.trim() ?? '';
  if (!url) return NextResponse.json({ usage: [] });
  // Reject bogus inputs. The URL must look like an http(s) URL to a
  // media asset; raw `%` would short-circuit four sequential-scan ILIKEs
  // across products.detail_body, products.detail_components,
  // menus.content, and pages.blocks — a DOS vector via any logged-in
  // admin session.
  if (url.length > 1024 || !/^https?:\/\//.test(url)) {
    return NextResponse.json({ usage: [] });
  }
  // Escape SQL LIKE wildcards in the operator's URL before wrapping it
  // in `%...%`. Without this, `%` or `_` in the URL itself match more
  // than they should AND amplify the table-scan cost.
  const likeEscaped = url.replace(/[\\%_]/g, '\\$&');

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const like = `%${likeEscaped}%`;
      const [
        products, subHero, carousel, promo, reviews, ig,
        detailBody, detailComponents, menus, pagesRefs,
      ] = await Promise.all([
        pool.query<{ id: string; name: string }>(
          `SELECT id, name FROM public.products WHERE images @> ARRAY[$1] LIMIT 5`,
          [url],
        ),
        pool.query<{ id: string }>(
          `SELECT id FROM public.sub_hero_banners WHERE image_url = $1 LIMIT 5`,
          [url],
        ),
        pool.query<{ id: string }>(
          `SELECT id FROM public.carousel_slides WHERE image_url = $1 LIMIT 5`,
          [url],
        ),
        pool.query<{ id: string }>(
          `SELECT id FROM public.promo_banners WHERE image_url = $1 LIMIT 5`,
          [url],
        ),
        pool.query<{ id: string; title: string | null }>(
          `SELECT id, title FROM public.review_cards WHERE image_url = $1 LIMIT 5`,
          [url],
        ),
        pool.query<{ id: string }>(
          `SELECT id FROM public.instagram_posts WHERE image_url = $1 LIMIT 5`,
          [url],
        ),
        pool.query<{ id: string; name: string }>(
          `SELECT id, name FROM public.products WHERE detail_body ILIKE $1 LIMIT 5`,
          [like],
        ),
        pool.query<{ id: string; name: string }>(
          `SELECT id, name FROM public.products WHERE detail_components::text ILIKE $1 LIMIT 5`,
          [like],
        ),
        pool.query<{ id: string; slug: string }>(
          `SELECT id, slug FROM public.menus WHERE content::text ILIKE $1 LIMIT 5`,
          [like],
        ),
        pool.query<{ id: string; slug: string }>(
          `SELECT id, slug FROM public.pages WHERE blocks::text ILIKE $1 LIMIT 5`,
          [like],
        ),
      ]);
      const usage: UsageHit[] = [];
      if (products.rowCount) usage.push({ table: 'products', label: '상품 메인 이미지', count: products.rows.length, examples: products.rows.map(r => r.name).filter(Boolean) });
      if (subHero.rowCount)  usage.push({ table: 'sub_hero_banners', label: '서브 히어로 배너', count: subHero.rows.length, examples: [] });
      if (carousel.rowCount) usage.push({ table: 'carousel_slides', label: '메인 캐러셀 슬라이드', count: carousel.rows.length, examples: [] });
      if (promo.rowCount)    usage.push({ table: 'promo_banners', label: '프로모 배너', count: promo.rows.length, examples: [] });
      if (reviews.rowCount)  usage.push({ table: 'review_cards', label: '리뷰 카드', count: reviews.rows.length, examples: reviews.rows.map(r => r.title ?? '').filter(Boolean) });
      if (ig.rowCount)       usage.push({ table: 'instagram_posts', label: '인스타 슬롯', count: ig.rows.length, examples: [] });
      if (detailBody.rowCount) usage.push({ table: 'products.detail_body', label: '상품 상세 본문 (에디터 내부 이미지)', count: detailBody.rows.length, examples: detailBody.rows.map(r => r.name).filter(Boolean) });
      if (detailComponents.rowCount) usage.push({ table: 'products.detail_components', label: '상품 상세 컴포넌트', count: detailComponents.rows.length, examples: detailComponents.rows.map(r => r.name).filter(Boolean) });
      if (menus.rowCount)    usage.push({ table: 'menus.content', label: '메뉴 페이지 본문', count: menus.rows.length, examples: menus.rows.map(r => r.slug) });
      if (pagesRefs.rowCount) usage.push({ table: 'pages.blocks', label: '페이지 빌더 블록', count: pagesRefs.rows.length, examples: pagesRefs.rows.map(r => r.slug) });
      return NextResponse.json({ usage });
    } catch (err) {
      console.error('[asset-usage] pg failed:', err);
      return NextResponse.json({ usage: [], error: 'usage_failed' }, { status: 500 });
    }
  }

  // Supabase fallback for non-prod parity.
  if (!supabase) return NextResponse.json({ usage: [] }, { status: 500 });
  const like = `%${likeEscaped}%`;
  const [
    products, subHero, carousel, promo, reviews, ig,
    detailBody, detailComponents, menus, pagesRefs,
  ] = await Promise.all([
    supabase.from('products').select('id, name').contains('images', [url]).limit(5),
    supabase.from('sub_hero_banners').select('id').eq('image_url', url).limit(5),
    supabase.from('carousel_slides').select('id').eq('image_url', url).limit(5),
    supabase.from('promo_banners').select('id').eq('image_url', url).limit(5),
    supabase.from('review_cards').select('id, title').eq('image_url', url).limit(5),
    supabase.from('instagram_posts').select('id').eq('image_url', url).limit(5),
    supabase.from('products').select('id, name').ilike('detail_body', like).limit(5),
    supabase.from('products').select('id, name').filter('detail_components::text', 'ilike', like).limit(5),
    supabase.from('menus').select('id, slug').filter('content::text', 'ilike', like).limit(5),
    supabase.from('pages').select('id, slug').filter('blocks::text', 'ilike', like).limit(5),
  ]);
  const usage: UsageHit[] = [];
  const push = (table: string, label: string, data: unknown[] | null, getEx?: (r: unknown) => string) => {
    if (data && data.length) usage.push({ table, label, count: data.length, examples: getEx ? data.map(getEx).filter(Boolean) : [] });
  };
  push('products', '상품 메인 이미지', products.data, (r) => (r as { name: string }).name);
  push('sub_hero_banners', '서브 히어로 배너', subHero.data);
  push('carousel_slides', '메인 캐러셀 슬라이드', carousel.data);
  push('promo_banners', '프로모 배너', promo.data);
  push('review_cards', '리뷰 카드', reviews.data, (r) => (r as { title: string }).title ?? '');
  push('instagram_posts', '인스타 슬롯', ig.data);
  push('products.detail_body', '상품 상세 본문', detailBody.data, (r) => (r as { name: string }).name);
  push('products.detail_components', '상품 상세 컴포넌트', detailComponents.data, (r) => (r as { name: string }).name);
  push('menus.content', '메뉴 페이지 본문', menus.data, (r) => (r as { slug: string }).slug);
  push('pages.blocks', '페이지 빌더 블록', pagesRefs.data, (r) => (r as { slug: string }).slug);
  return NextResponse.json({ usage });
}
