import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const MAX_CONTENT = 4000;

/**
 * POST /api/admin/comments
 * Same shape as /api/customer/comments but allows `is_admin_comment=true`
 * for the admin badge.
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { post_id, parent_id, author_name, content, is_admin_comment } = body as {
    post_id?: string; parent_id?: string | null; author_name?: string; content?: string; is_admin_comment?: boolean;
  };
  if (!post_id || !author_name || !content || content.length > MAX_CONTENT) {
    return NextResponse.json({ ok: false, error: 'invalid payload' }, { status: 400 });
  }

  if (process.env.USE_RDS === 'true') {
    try {
      const { createCommentInPg } = await import('@/lib/db/admin-writes');
      const row = await createCommentInPg({
        post_id, parent_id: parent_id ?? null,
        author_name: author_name.trim().slice(0, 80),
        content,
        is_admin_comment: !!is_admin_comment,
      });
      return NextResponse.json({ ok: true, comment: row });
    } catch (err) {
      console.error('[admin/comments] pg insert failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { data, error } = await supabase.from('comments').insert([{
    post_id, parent_id: parent_id ?? null,
    author_name: author_name.trim().slice(0, 80),
    content,
    is_admin_comment: !!is_admin_comment,
  }]).select('*').maybeSingle();
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, comment: data });
}
