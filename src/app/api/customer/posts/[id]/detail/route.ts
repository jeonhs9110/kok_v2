import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomerOptional } from '@/lib/auth/requireCustomer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

interface Ctx { params: Promise<{ id: string }> }

/**
 * GET /api/customer/posts/[id]/detail → { post }
 *
 * Reads a single post. Used by both the public storefront detail view
 * AND the customer's own edit form for drafts.
 *
 * Visibility rule (added 2026-06-29 after the audit):
 *   - is_published=true → readable by anyone (no auth needed)
 *   - is_published=false → readable only by the post's author
 *
 * Previously this returned ANY post by id with no auth or published
 * check, which leaked operator drafts (admin announcements queued for
 * later release, customer-written posts the author paused mid-edit)
 * to anyone who guessed a UUID or scraped one off the network tab.
 */
export async function GET(_req: Request, { params }: Ctx) {
  const { id } = await params;
  if (!id) return NextResponse.json({ post: null }, { status: 400 });

  // Optional auth — we still want public reads of published posts to
  // work without forcing a login round-trip. requireCustomerOptional
  // returns null when there's no Cognito cookie instead of a 401.
  const auth = await requireCustomerOptional();

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const { rows } = await pool.query<{ is_published: boolean; author_id: string | null }>(
        `SELECT * FROM public.posts WHERE id = $1 LIMIT 1`,
        [id],
      );
      const post = rows[0];
      if (!post) return NextResponse.json({ post: null }, { status: 404 });
      const isOwner = !!auth && !!post.author_id && auth.userId === post.author_id;
      if (!post.is_published && !isOwner) {
        return NextResponse.json({ post: null }, { status: 404 });
      }
      return NextResponse.json({ post });
    } catch (err) {
      console.error('[customer/posts/detail] pg read failed:', err);
      return NextResponse.json({ post: null }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ post: null }, { status: 500 });
  const { data } = await supabase.from('posts').select('*').eq('id', id).maybeSingle();
  if (!data) return NextResponse.json({ post: null }, { status: 404 });
  const isOwner = !!auth && data.author_id && auth.userId === data.author_id;
  if (!data.is_published && !isOwner) {
    return NextResponse.json({ post: null }, { status: 404 });
  }
  return NextResponse.json({ post: data });
}
