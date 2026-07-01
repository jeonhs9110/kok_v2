import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { assertSameOrigin } from '@/lib/http/csrf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Ctx { params: Promise<{ id: string }> }

/**
 * DELETE /api/admin/comments/[id] — admin deletes any comment.
 */
export async function DELETE(req: Request, { params }: Ctx) {
  // Round 29: admin DELETE was riding the operator cookie without an
  // origin check. A phishing page open in another tab could delete
  // arbitrary comments while `kokkok_admin_auth` was live. Matches
  // the customer route + all other admin write routes touched in R22.
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      // 0-rows-affected means the comment is already gone (deleted in
      // another tab, never existed, wrong id). Previously we still
      // returned { ok: true } and the operator's UI removed the row
      // optimistically — fine if the row was truly already gone, but
      // it hides the case where the operator's id was just stale and
      // they then move on assuming everything matches. Return 404 so
      // the client can refresh and resync.
      const { rowCount } = await pool.query(`DELETE FROM public.comments WHERE id = $1`, [id]);
      if ((rowCount ?? 0) === 0) {
        return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[admin/comments] pg delete failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error, count } = await supabase.from('comments').delete({ count: 'exact' }).eq('id', id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  if ((count ?? 0) === 0) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
