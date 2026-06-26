import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomer } from '@/lib/auth/requireCustomer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Ctx { params: Promise<{ id: string }> }

/**
 * PATCH /api/customer/posts/[id] { title?, content? }
 * Update own post (author_id must match). Admin can update any post —
 * for the simpler scope here we only support self-edits.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { title, content } = body as { title?: string; content?: string };

  const fields: Record<string, unknown> = {};
  if (typeof title === 'string' && title.length > 0 && title.length <= 200) fields.title = title;
  if (typeof content === 'string' && content.length > 0 && content.length <= 50_000) fields.content = content;
  if (Object.keys(fields).length === 0) return NextResponse.json({ ok: false, error: 'no updatable fields' }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const cols = Object.keys(fields);
      const sets = cols.map((c, i) => `${c} = $${i + 3}`).join(', ');
      const values = cols.map(c => fields[c]);
      const { rowCount } = await pool.query(
        `UPDATE public.posts SET ${sets}, updated_at = now()
           WHERE id = $1 AND author_id = $2`,
        [id, auth.userId, ...values],
      );
      if ((rowCount ?? 0) === 0) return NextResponse.json({ ok: false }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[customer/posts] pg update failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('posts').update(fields).eq('id', id).eq('author_id', auth.userId);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/customer/posts/[id]
 * Delete own post. Admin uses /api/admin/posts/[id] for any-post delete.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const { rowCount } = await pool.query(
        `DELETE FROM public.posts WHERE id = $1 AND author_id = $2`,
        [id, auth.userId],
      );
      if ((rowCount ?? 0) === 0) return NextResponse.json({ ok: false }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[customer/posts] pg delete failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('posts').delete().eq('id', id).eq('author_id', auth.userId);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
