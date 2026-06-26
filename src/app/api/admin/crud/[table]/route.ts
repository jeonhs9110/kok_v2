import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

/**
 * Generic admin CRUD endpoint, allow-listed.
 *
 * GET    /api/admin/crud/[table]?orderBy=&direction=&filter=k:v
 * POST   /api/admin/crud/[table]  {row}                     → insert
 * PATCH  /api/admin/crud/[table]  {id, patch}               → update
 * DELETE /api/admin/crud/[table]?id=ID
 *
 * Tables allowed: low-risk admin-config + community CRUD. NOT in the
 * allow-list: products / users / wishlist / customer_profiles / orders /
 * cart_items / analytics. Those have purpose-built routes elsewhere so
 * we get tighter validation + specific dispatcher behavior.
 */
const ALLOWED_TABLES = new Set<string>([
  'menus',
  'pages',
  'posts',
  'legal_pages',
  'categories',
  'ingredient_tags',
  'review_cards',
  'media_stories',
  'chatbot_config',
  'chatbot_leads',
  'payment_providers_config',
  'registration_config',
  'auth_providers_config',
  'identity_verification_config',
  'business_info',
  'instagram_config',
  'instagram_posts',
  'shorts',
  'shorts_config',
  'site_backgrounds',
  'product_ingredient_tags',
]);

const SAFE_IDENT = /^[a-z_][a-z0-9_]*$/i;

interface Ctx { params: Promise<{ table: string }> }

function quoteIdent(s: string): string {
  if (!SAFE_IDENT.test(s)) throw new Error(`invalid identifier: ${s}`);
  return `"${s}"`;
}

function allowedTable(table: string): boolean {
  return ALLOWED_TABLES.has(table) && SAFE_IDENT.test(table);
}

export async function GET(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { table } = await params;
  if (!allowedTable(table)) return NextResponse.json({ rows: [] }, { status: 404 });

  const url = new URL(req.url);
  const orderByRaw = url.searchParams.get('orderBy') ?? 'created_at';
  const directionRaw = (url.searchParams.get('direction') ?? 'DESC').toUpperCase();
  const orderBy = SAFE_IDENT.test(orderByRaw) ? orderByRaw : 'created_at';
  const direction: 'ASC' | 'DESC' = directionRaw === 'ASC' ? 'ASC' : 'DESC';
  const filterRaw = url.searchParams.get('filter') ?? '';
  const filter: { col: string; val: string } | null = (() => {
    const idx = filterRaw.indexOf(':');
    if (idx <= 0) return null;
    const col = filterRaw.slice(0, idx);
    const val = filterRaw.slice(idx + 1);
    if (!SAFE_IDENT.test(col)) return null;
    return { col, val };
  })();

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const where = filter ? `WHERE ${quoteIdent(filter.col)} = $1` : '';
      const params = filter ? [filter.val] : [];
      const sql = `SELECT * FROM public.${quoteIdent(table)} ${where} ORDER BY ${quoteIdent(orderBy)} ${direction}`;
      const { rows } = await pool.query(sql, params);
      return NextResponse.json({ rows });
    } catch (err) {
      console.error(`[admin/crud/${table}] pg list failed:`, err);
      return NextResponse.json({ rows: [] }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ rows: [] }, { status: 500 });
  let q = supabase.from(table).select('*').order(orderBy, { ascending: direction === 'ASC' });
  if (filter) q = q.eq(filter.col, filter.val);
  const { data } = await q;
  return NextResponse.json({ rows: data ?? [] });
}

export async function POST(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { table } = await params;
  if (!allowedTable(table)) return NextResponse.json({ ok: false }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const row = body as Record<string, unknown>;
  const cols = Object.keys(row).filter(k => SAFE_IDENT.test(k));
  if (cols.length === 0) return NextResponse.json({ ok: false, error: 'no valid columns' }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const placeholders = cols.map((_, i) => `$${i + 1}`).join(', ');
      const colsSql = cols.map(quoteIdent).join(', ');
      const values = cols.map(c => row[c]);
      const sql = `INSERT INTO public.${quoteIdent(table)} (${colsSql}) VALUES (${placeholders}) RETURNING *`;
      const { rows } = await pool.query(sql, values);
      return NextResponse.json({ ok: true, row: rows[0] });
    } catch (err) {
      console.error(`[admin/crud/${table}] pg insert failed:`, err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const cleanRow = Object.fromEntries(cols.map(c => [c, row[c]]));
  const { data, error } = await supabase.from(table).insert([cleanRow]).select('*').maybeSingle();
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true, row: data });
}

export async function PATCH(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { table } = await params;
  if (!allowedTable(table)) return NextResponse.json({ ok: false }, { status: 404 });

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { id, patch } = body as { id?: string; patch?: Record<string, unknown> };
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });
  if (!patch || typeof patch !== 'object') return NextResponse.json({ ok: false, error: 'patch required' }, { status: 400 });
  const cols = Object.keys(patch).filter(k => SAFE_IDENT.test(k));
  if (cols.length === 0) return NextResponse.json({ ok: false, error: 'no valid columns' }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const sets = cols.map((c, i) => `${quoteIdent(c)} = $${i + 2}`).join(', ');
      const values = cols.map(c => patch[c]);
      const sql = `UPDATE public.${quoteIdent(table)} SET ${sets} WHERE id = $1`;
      const { rowCount } = await pool.query(sql, [id, ...values]);
      if ((rowCount ?? 0) === 0) return NextResponse.json({ ok: false }, { status: 404 });
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error(`[admin/crud/${table}] pg update failed:`, err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const cleanPatch = Object.fromEntries(cols.map(c => [c, patch[c]]));
  const { error } = await supabase.from(table).update(cleanPatch).eq('id', id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(req: Request, { params }: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;
  const { table } = await params;
  if (!allowedTable(table)) return NextResponse.json({ ok: false }, { status: 404 });
  const id = new URL(req.url).searchParams.get('id');
  if (!id) return NextResponse.json({ ok: false, error: 'id required' }, { status: 400 });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      await pool.query(`DELETE FROM public.${quoteIdent(table)} WHERE id = $1`, [id]);
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error(`[admin/crud/${table}] pg delete failed:`, err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
