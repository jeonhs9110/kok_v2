import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Ctx { params: Promise<{ id: string }> }

/**
 * GET /api/customer/posts/[id]/detail → { post }
 * Read a single published post. Used by the edit form. Public-readable.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!id) return NextResponse.json({ post: null }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const { rows } = await pool.query(
        `SELECT * FROM public.posts WHERE id = $1 LIMIT 1`,
        [id],
      );
      return NextResponse.json({ post: rows[0] ?? null });
    } catch (err) {
      console.error('[customer/posts/detail] pg read failed:', err);
      return NextResponse.json({ post: null }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ post: null }, { status: 500 });
  const { data } = await supabase.from('posts').select('*').eq('id', id).maybeSingle();
  return NextResponse.json({ post: data ?? null });
}
