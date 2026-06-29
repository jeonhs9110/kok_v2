import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const MAX_NAME = 80;
const MAX_TITLE = 120;
const MAX_CONTENT = 4000;

// Per-IP rate limit on POST. Reviews are unauthenticated (legacy
// constraint — many storefronts let walk-up customers leave a review
// without an account) so the only abuse brake is a per-IP cap. 5 per
// hour comfortably covers a legitimate customer who leaves one review
// per product they bought; blocks scripted floods + bot-stuffed
// 5-star spam runs. Refactored 2026-06-29 to the shared limiter.
const reviewLimiter = createRateLimiter({
  name: 'product_reviews',
  limit: 5,
  windowMs: 60 * 60 * 1000,
});

interface RouteContext {
  params: Promise<{ id: string }>;
}

/**
 * GET /api/products/[id]/reviews
 * List published reviews for a product, newest first.
 *
 * Customer-facing endpoint — no auth. ProductReviewSection.tsx
 * fetches this on mount and after each successful POST.
 */
export async function GET(_req: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!id) return NextResponse.json({ reviews: [] }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getProductReviewsFromPg } = await import('@/lib/db/storefront-reads');
      const rows = await getProductReviewsFromPg(id);
      return NextResponse.json({ reviews: rows });
    } catch (err) {
      console.error(`[reviews] pg list failed (${id}):`, err);
      return NextResponse.json({ reviews: [] }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ reviews: [] }, { status: 500 });
  const { data, error } = await supabase
    .from('product_reviews')
    .select('*')
    .eq('product_id', id)
    .eq('is_published', true)
    .order('created_at', { ascending: false });
  if (error) {
    console.error(`[reviews] supabase list failed (${id}):`, error);
    return NextResponse.json({ reviews: [] }, { status: 500 });
  }
  return NextResponse.json({ reviews: data ?? [] });
}

/**
 * POST /api/products/[id]/reviews
 * Submit a review. Body: { author_name, rating, title|null, content }
 *
 * Customer-facing — no auth. Server validates length + rating bounds.
 */
export async function POST(req: Request, { params }: RouteContext) {
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false, error: 'product_id required' }, { status: 400 });

  if (!reviewLimiter.check(getRequestIp(req))) {
    return NextResponse.json(
      { ok: false, error: 'too_many_requests' },
      { status: 429 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid json' }, { status: 400 });
  }

  const { author_name, rating, title, content } = body as {
    author_name?: unknown;
    rating?: unknown;
    title?: unknown;
    content?: unknown;
  };

  const name = typeof author_name === 'string' ? author_name.trim() : '';
  const text = typeof content === 'string' ? content.trim() : '';
  const t = typeof title === 'string' ? title.trim() : '';
  const r = Number(rating);

  if (!name || name.length > MAX_NAME) {
    return NextResponse.json({ ok: false, error: 'invalid author_name' }, { status: 400 });
  }
  if (!text || text.length > MAX_CONTENT) {
    return NextResponse.json({ ok: false, error: 'invalid content' }, { status: 400 });
  }
  if (t.length > MAX_TITLE) {
    return NextResponse.json({ ok: false, error: 'invalid title' }, { status: 400 });
  }
  if (!Number.isFinite(r) || r < 1 || r > 5) {
    return NextResponse.json({ ok: false, error: 'invalid rating' }, { status: 400 });
  }

  if (process.env.USE_RDS === 'true') {
    try {
      // Verify the product exists + is_active before accepting the
      // review. Without this, a script could POST reviews to deleted or
      // never-existed product UUIDs to spam the products_reviews table.
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const productCheck = await pool.query<{ is_active: boolean }>(
        `SELECT is_active FROM public.products WHERE id = $1 LIMIT 1`,
        [id],
      );
      const product = productCheck.rows[0];
      if (!product || !product.is_active) {
        return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 });
      }

      const { insertProductReviewInPg } = await import('@/lib/db/admin-writes');
      const ok = await insertProductReviewInPg({
        product_id: id,
        author_name: name,
        rating: r,
        title: t || null,
        content: text,
      });
      if (!ok) return NextResponse.json({ ok: false }, { status: 500 });
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error(`[reviews] pg insert failed (${id}):`, err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('product_reviews').insert({
    product_id: id,
    author_name: name,
    rating: r,
    title: t || null,
    content: text,
  });
  if (error) {
    console.error(`[reviews] supabase insert failed (${id}):`, error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
