import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { assertSameOrigin } from '@/lib/http/csrf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Ctx { params: Promise<{ id: string }> }

const UPDATABLE = ['title', 'content', 'is_admin_post', 'is_published'] as const;

/**
 * PATCH /api/admin/posts/[id]
 * Admin can edit any post + flip pin/publish flags.
 */
export async function PATCH(req: Request, { params }: Ctx) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const payload = body as Record<string, unknown>;
  const fields: Record<string, unknown> = {};
  for (const k of UPDATABLE) if (k in payload) fields[k] = payload[k];
  if (Object.keys(fields).length === 0) return NextResponse.json({ ok: false, error: 'no updatable fields' }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const cols = Object.keys(fields);
      const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
      const values = cols.map(c => fields[c]);
      const { rowCount } = await pool.query(
        `UPDATE public.posts SET ${sets}, updated_at = now() WHERE id = $1`,
        [id, ...values],
      );
      if ((rowCount ?? 0) === 0) return NextResponse.json({ ok: false }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[admin/posts] pg update failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('posts').update(fields).eq('id', id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/admin/posts/[id]
 * Admin deletes any post regardless of author.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    // Wrap in a transaction so the post + its comments are deleted
    // atomically. Without this, deleting a post would leave orphan
    // comment rows pointing at a non-existent post_id — invisible in
    // the admin UI but they accumulate in the DB and would surface as
    // dangling FK references on any future cleanup. The customer-side
    // delete already does this; the admin path was the only outlier.
    const { getPgPool } = await import('@/lib/db/pool');
    const pool = getPgPool();
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`DELETE FROM public.comments WHERE post_id = $1`, [id]);
      await client.query(`DELETE FROM public.posts WHERE id = $1`, [id]);
      await client.query('COMMIT');
      return NextResponse.json({ ok: true });
    } catch (err) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[admin/posts] pg delete failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    } finally {
      client.release();
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('posts').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
