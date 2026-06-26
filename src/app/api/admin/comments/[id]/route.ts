import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Ctx { params: Promise<{ id: string }> }

/**
 * DELETE /api/admin/comments/[id] — admin deletes any comment.
 */
export async function DELETE(_req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { id } = await params;
  if (!id) return NextResponse.json({ ok: false }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      await pool.query(`DELETE FROM public.comments WHERE id = $1`, [id]);
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[admin/comments] pg delete failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
