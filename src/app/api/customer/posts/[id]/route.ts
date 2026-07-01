import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomer } from '@/lib/auth/requireCustomer';
import { assertSameOrigin } from '@/lib/http/csrf';

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
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
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
export async function DELETE(req: Request, { params }: Ctx) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      // 2026-06-29: cascade comments. Mirror of deletePostInPg
      // (admin path). The customer-owned post delete used to leave
      // comments orphaned with a dangling post_id; same accumulating
      // tech-debt symptom on every owner-initiated delete. The
      // ownership gate stays — we only delete comments when the
      // post-row itself matched (the SELECT … FOR UPDATE inside the
      // transaction guarantees nobody else flipped author_id between
      // the check and the comment delete).
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const post = await client.query<{ id: string }>(
          `SELECT id FROM public.posts WHERE id = $1 AND author_id = $2 FOR UPDATE`,
          [id, auth.userId],
        );
        if ((post.rowCount ?? 0) === 0) {
          await client.query('ROLLBACK');
          return NextResponse.json({ ok: false }, { status: 404 });
        }
        await client.query(`DELETE FROM public.comments WHERE post_id = $1`, [id]);
        await client.query(
          `DELETE FROM public.posts WHERE id = $1 AND author_id = $2`,
          [id, auth.userId],
        );
        await client.query('COMMIT');
        return NextResponse.json({ ok: true });
      } catch (err) {
        await client.query('ROLLBACK').catch(() => { /* connection may be gone */ });
        throw err;
      } finally {
        client.release();
      }
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
