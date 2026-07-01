import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomer } from '@/lib/auth/requireCustomer';
import { assertSameOrigin } from '@/lib/http/csrf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Ctx { params: Promise<{ id: string }> }

/**
 * DELETE /api/customer/comments/[id]
 * Comments table doesn't carry an author_id column, so we approximate
 * "own comment" by matching the auth email against author_name. Admins
 * can delete any comment via /api/admin/comments/[id] (separate route).
 */
export async function DELETE(req: Request, { params }: Ctx) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });
  // Refuse the delete unless we have a non-empty email to match on. Without
  // this guard, `auth.email ?? ''` would match every legacy comment whose
  // author_name happens to be empty — letting a signed-in user delete
  // arbitrary comments that nobody owns.
  if (!auth.email) return NextResponse.json({ ok: false, error: 'no_identity' }, { status: 403 });
  const guard = auth.email;

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const { rowCount } = await pool.query(
        `DELETE FROM public.comments WHERE id = $1 AND author_name = $2`,
        [id, guard],
      );
      if ((rowCount ?? 0) === 0) return NextResponse.json({ ok: false }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[customer/comments] pg delete failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('comments').delete().eq('id', id).eq('author_name', guard);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
