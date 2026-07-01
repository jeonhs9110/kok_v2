import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomer } from '@/lib/auth/requireCustomer';
import { assertSameOrigin } from '@/lib/http/csrf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * GET /api/customer/wishlist[?details=1]
 *   default → { productIds: string[] }
 *   details → { productIds, items: [{wishlistId, productId, name, image, price}] }
 *
 * The detail variant joins wishlist + products so the MyPage "위시리스트" tab
 * can render names/images/prices without a second round trip.
 */
export async function GET(req: Request) {
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  const wantDetails = new URL(req.url).searchParams.get('details') === '1';

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      if (wantDetails) {
        const { rows } = await pool.query<{
          wishlist_id: string; product_id: string; name: string; images: string[] | null; price: string;
        }>(
          // Round 32: LIMIT 500. Prior unbounded state let a customer
          // (or a bot spamming the "add to wishlist" endpoint) accumulate
          // 10k+ wishlisted items that would then pin a pool connection
          // through the whole LEFT JOIN + sort on every /my-page load.
          // Matches the LIMIT 500 pattern used elsewhere for
          // comments/reviews.
          `SELECT w.id AS wishlist_id, w.product_id, p.name, p.images, p.price::text
             FROM public.wishlist w
             LEFT JOIN public.products p ON p.id = w.product_id
            WHERE w.user_id = $1
            ORDER BY w.created_at DESC
            LIMIT 500`,
          [auth.userId],
        );
        return NextResponse.json({
          productIds: rows.map(r => r.product_id),
          items: rows.map(r => ({
            wishlistId: r.wishlist_id,
            productId: r.product_id,
            name: r.name ?? '',
            image: (r.images ?? [])[0] ?? '',
            price: Number(r.price ?? 0),
          })),
        });
      }
      const { rows } = await pool.query<{ product_id: string }>(
        // Round 32: same LIMIT 500 rationale as the details branch above.
        `SELECT product_id FROM public.wishlist WHERE user_id = $1 LIMIT 500`,
        [auth.userId],
      );
      return NextResponse.json({ productIds: rows.map(r => r.product_id) });
    } catch (err) {
      console.error('[customer/wishlist] pg list failed:', err);
      return NextResponse.json({ productIds: [], items: [] }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ productIds: [], items: [] }, { status: 500 });
  if (wantDetails) {
    const { data } = await supabase
      .from('wishlist')
      .select('id, product_id, products(name, images, price)')
      .eq('user_id', auth.userId)
      .order('created_at', { ascending: false });
    type Row = { id: string; product_id: string; products: { name: string; images: string[]; price: number | string } | null };
    const rows = (data ?? []) as unknown as Row[];
    return NextResponse.json({
      productIds: rows.map(r => r.product_id),
      items: rows.map(r => ({
        wishlistId: r.id,
        productId: r.product_id,
        name: r.products?.name ?? '',
        image: r.products?.images?.[0] ?? '',
        price: Number(r.products?.price ?? 0),
      })),
    });
  }
  const { data } = await supabase.from('wishlist').select('product_id').eq('user_id', auth.userId);
  return NextResponse.json({ productIds: (data ?? []).map(d => d.product_id) });
}

/**
 * POST /api/customer/wishlist { productId }
 * Toggles wishlist membership for the signed-in customer.
 * Returns { wishlisted: true|false }.
 */
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { productId } = body as { productId?: string };
  if (!productId || typeof productId !== 'string') {
    return NextResponse.json({ ok: false, error: 'productId required' }, { status: 400 });
  }

  if (process.env.USE_RDS === 'true') {
    const { getPgPool } = await import('@/lib/db/pool');
    const pool = getPgPool();
    // Pull a dedicated connection from the pool so SELECT FOR UPDATE +
    // DELETE/INSERT run inside the same transaction. The prior code
    // used two pool.query() calls back-to-back, which could route to
    // different connections and miss the lock semantics entirely —
    // two browser tabs (or mobile + desktop) toggling the same product
    // could both see "doesn't exist", both INSERT, leaving the row
    // duplicated in the table (and the heart in an indeterminate state
    // depending on which response landed last).
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const existing = await client.query(
        `SELECT 1 FROM public.wishlist
          WHERE user_id = $1 AND product_id = $2
          FOR UPDATE`,
        [auth.userId, productId],
      );
      if ((existing.rowCount ?? 0) > 0) {
        // DELETE clears all matching rows in one shot, which also
        // cleans up any duplicates left behind by past races.
        await client.query(
          `DELETE FROM public.wishlist WHERE user_id = $1 AND product_id = $2`,
          [auth.userId, productId],
        );
        await client.query('COMMIT');
        return NextResponse.json({ wishlisted: false });
      }
      await client.query(
        `INSERT INTO public.wishlist (user_id, product_id) VALUES ($1, $2)`,
        [auth.userId, productId],
      );
      await client.query('COMMIT');
      return NextResponse.json({ wishlisted: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => { /* connection may be gone */ });
      console.error('[customer/wishlist] pg toggle failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    } finally {
      client.release();
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { data: existing } = await supabase
    .from('wishlist')
    .select('product_id')
    .eq('user_id', auth.userId)
    .eq('product_id', productId)
    .maybeSingle();
  if (existing) {
    await supabase.from('wishlist').delete().eq('user_id', auth.userId).eq('product_id', productId);
    return NextResponse.json({ wishlisted: false });
  }
  await supabase.from('wishlist').insert([{ user_id: auth.userId, product_id: productId }]);
  return NextResponse.json({ wishlisted: true });
}
