import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomer } from '@/lib/auth/requireCustomer';
import { deriveStoredAuthorName } from '@/lib/customer/maskAuthor';
import { assertSameOrigin } from '@/lib/http/csrf';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const MAX_CONTENT = 4000;

/**
 * GET /api/customer/comments?postId=ID
 * List published comments on a post (anyone signed in can read).
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const postId = url.searchParams.get('postId');
  if (!postId) return NextResponse.json({ comments: [] }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getCommentsByPostFromPg } = await import('@/lib/db/storefront-reads');
      const rows = await getCommentsByPostFromPg(postId);
      return NextResponse.json({ comments: rows });
    } catch (err) {
      console.error('[customer/comments] pg list failed:', err);
      return NextResponse.json({ comments: [] }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ comments: [] }, { status: 500 });
  const { data } = await supabase.from('comments').select('*').eq('post_id', postId).order('created_at', { ascending: true });
  return NextResponse.json({ comments: data ?? [] });
}

/**
 * POST /api/customer/comments { post_id, parent_id?, author_name, content }
 * Create a comment as the signed-in customer.
 */
export async function POST(req: Request) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { post_id, parent_id, author_name, content } = body as {
    post_id?: string; parent_id?: string | null; author_name?: string; content?: string;
  };

  if (!post_id) return NextResponse.json({ ok: false, error: 'post_id required' }, { status: 400 });
  // Reject whitespace-only — '   ' previously slipped past the length
  // check and inserted a blank comment row.
  if (!content || typeof content !== 'string' || content.trim().length === 0 || content.length > MAX_CONTENT) {
    return NextResponse.json({ ok: false, error: 'invalid content' }, { status: 400 });
  }
  const name = deriveStoredAuthorName({
    supplied: typeof author_name === 'string' ? author_name : null,
    userId: auth.userId,
    email: auth.email,
  });
  const parent = typeof parent_id === 'string' && parent_id.length > 0 ? parent_id : null;

  if (process.env.USE_RDS === 'true') {
    try {
      // Verify the post exists and is published before accepting the
      // comment. Without this gate a signed-in customer could POST a
      // comment against any post id (including drafts the operator
      // never published, or rows from a deleted board) — the comment
      // would write but not render anywhere visible, and an admin
      // reviewing the comments queue would see ghost entries
      // pointing at posts that don't exist.
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const postCheck = await pool.query<{ is_published: boolean }>(
        `SELECT is_published FROM public.posts WHERE id = $1 LIMIT 1`,
        [post_id],
      );
      const post = postCheck.rows[0];
      if (!post || !post.is_published) {
        return NextResponse.json({ ok: false, error: 'post_not_available' }, { status: 404 });
      }

      const { createCommentInPg } = await import('@/lib/db/admin-writes');
      const row = await createCommentInPg({
        post_id, parent_id: parent, author_name: name, content, is_admin_comment: false,
      });
      return NextResponse.json({ ok: true, comment: row });
    } catch (err) {
      console.error('[customer/comments] pg insert failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { data, error } = await supabase.from('comments').insert([{
    post_id, parent_id: parent, author_name: name, content, is_admin_comment: false,
  }]).select('*').maybeSingle();
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, comment: data });
}
