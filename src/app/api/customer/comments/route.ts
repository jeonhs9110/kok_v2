import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomer } from '@/lib/auth/requireCustomer';

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
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { post_id, parent_id, author_name, content } = body as {
    post_id?: string; parent_id?: string | null; author_name?: string; content?: string;
  };

  if (!post_id) return NextResponse.json({ ok: false, error: 'post_id required' }, { status: 400 });
  if (!content || typeof content !== 'string' || content.length === 0 || content.length > MAX_CONTENT) {
    return NextResponse.json({ ok: false, error: 'invalid content' }, { status: 400 });
  }
  const name = (typeof author_name === 'string' && author_name.trim().length > 0 ? author_name.trim() : auth.email ?? 'anonymous').slice(0, 80);
  const parent = typeof parent_id === 'string' && parent_id.length > 0 ? parent_id : null;

  if (process.env.USE_RDS === 'true') {
    try {
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
