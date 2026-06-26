import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Ctx { params: Promise<{ id: string }> }

/**
 * GET /api/admin/users/[id]/details
 * Admin view of a single customer: account row + profile + wishlist
 * (with product names/prices) + posts authored + recent orders.
 * Dispatches to RDS via USE_RDS. Admin-only — regular admins can view;
 * mutations on the user (role / delete) are super-admin only.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const [user, profile, wishlist, posts, orders] = await Promise.all([
        pool.query(`SELECT id, email, role, is_verified, created_at FROM public.users WHERE id = $1`, [id]),
        pool.query(`SELECT * FROM public.customer_profiles WHERE id = $1`, [id]),
        pool.query(
          `SELECT w.id, w.product_id, w.created_at, p.name AS product_name, p.images, p.price::text AS price
             FROM public.wishlist w
             LEFT JOIN public.products p ON p.id = w.product_id
            WHERE w.user_id = $1
            ORDER BY w.created_at DESC`,
          [id],
        ),
        pool.query(
          `SELECT id, menu_id, title, created_at FROM public.posts
            WHERE author_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [id],
        ),
        pool.query(
          `SELECT id, total_amount, status, created_at FROM public.orders
            WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
          [id],
        ).catch(() => ({ rows: [] })),
      ]);
      return NextResponse.json({
        user: user.rows[0] ?? null,
        profile: profile.rows[0] ?? null,
        wishlist: wishlist.rows,
        posts: posts.rows,
        orders: orders.rows,
      });
    } catch (err) {
      console.error('[admin/users/details] pg fetch failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const [userRes, profileRes, wishRes, postsRes] = await Promise.all([
    supabase.from('users').select('id, email, role, is_verified, created_at').eq('id', id).maybeSingle(),
    supabase.from('customer_profiles').select('*').eq('id', id).maybeSingle(),
    supabase.from('wishlist').select('id, product_id, created_at, products(name, images, price)').eq('user_id', id).order('created_at', { ascending: false }),
    supabase.from('posts').select('id, menu_id, title, created_at').eq('author_id', id).order('created_at', { ascending: false }).limit(50),
  ]);
  return NextResponse.json({
    user: userRes.data ?? null,
    profile: profileRes.data ?? null,
    wishlist: wishRes.data ?? [],
    posts: postsRes.data ?? [],
    orders: [],
  });
}
