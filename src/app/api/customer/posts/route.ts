import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomer } from '@/lib/auth/requireCustomer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const MAX_TITLE = 200;
const MAX_CONTENT = 50_000;

/**
 * POST /api/customer/posts { menu_id, title, content, author_name? }
 * Create a new community-board post as the signed-in customer.
 */
export async function POST(req: Request) {
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { menu_id, title, content, author_name } = body as {
    menu_id?: string; title?: string; content?: string; author_name?: string;
  };

  if (!menu_id || typeof menu_id !== 'string') return NextResponse.json({ ok: false, error: 'menu_id required' }, { status: 400 });
  if (!title || typeof title !== 'string' || title.length === 0 || title.length > MAX_TITLE) return NextResponse.json({ ok: false, error: 'invalid title' }, { status: 400 });
  if (!content || typeof content !== 'string' || content.length === 0 || content.length > MAX_CONTENT) return NextResponse.json({ ok: false, error: 'invalid content' }, { status: 400 });
  const name = (typeof author_name === 'string' ? author_name : auth.email ?? 'anonymous').slice(0, 80);

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      // Verify the menu actually allows customer posts before inserting.
      // Without this gate a customer could craft a request with the id
      // of an admin-only board (e.g., 공지사항) and POST to it — the
      // storefront wouldn't show it as customer-writable, but the API
      // would happily insert a row that then renders on the admin board.
      // Gate: page_type='board' AND board_write_role != 'admin' AND
      // is_published=true.
      const menuCheck = await pool.query<{ page_type: string; board_write_role: string | null; is_published: boolean }>(
        `SELECT page_type, board_write_role, is_published
           FROM public.menus
          WHERE id = $1
          LIMIT 1`,
        [menu_id],
      );
      const m = menuCheck.rows[0];
      if (!m || m.page_type !== 'board' || m.board_write_role === 'admin' || !m.is_published) {
        return NextResponse.json({ ok: false, error: 'forbidden' }, { status: 403 });
      }

      const { rows } = await pool.query<{ id: string }>(
        `INSERT INTO public.posts (menu_id, title, content, author_name, author_id, is_admin_post, is_published)
           VALUES ($1, $2, $3, $4, $5, false, true)
           RETURNING id`,
        [menu_id, title, content, name, auth.userId],
      );
      return NextResponse.json({ ok: true, id: rows[0]?.id });
    } catch (err) {
      console.error('[customer/posts] pg insert failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { data, error } = await supabase.from('posts').insert([{
    menu_id, title, content, author_name: name, author_id: auth.userId, is_admin_post: false, is_published: true,
  }]).select('id').maybeSingle();
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, id: data?.id });
}
