import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import { assertSameOrigin } from '@/lib/http/csrf';

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
  'homepage_banners',
  // Added 2026-06-29 — /admin/worldwide was talking directly to Supabase
  // for both reads + writes, so it broke silently after the 2026-06-27
  // Supabase decommission. Routing through the generic CRUD dispatcher
  // gives it the same USE_RDS path as every other admin page.
  'worldwide_retailers',
  'worldwide_labels',
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
  // Default to `id` because every allow-listed table has it. Some
  // singleton config tables (legal_pages, chatbot_config) carry only
  // `updated_at` and would 500 on a bare GET if the default were
  // `created_at`. Callers that explicitly need created_at / sort_order
  // / nav_order pass it via ?orderBy=.
  const orderByRaw = url.searchParams.get('orderBy') ?? 'id';
  const directionRaw = (url.searchParams.get('direction') ?? 'DESC').toUpperCase();
  const orderBy = SAFE_IDENT.test(orderByRaw) ? orderByRaw : 'id';
  const direction: 'ASC' | 'DESC' = directionRaw === 'ASC' ? 'ASC' : 'DESC';
  const filterRaw = url.searchParams.get('filter') ?? '';
  const filter: { col: string; val: string } | null = (() => {
    const idx = filterRaw.indexOf(':');
    if (idx <= 0) return null;
    const col = filterRaw.slice(0, idx);
    const val = filterRaw.slice(idx + 1);
    if (!SAFE_IDENT.test(col)) return null;
    // Round 31: cap `val` at 200 chars so a `filter=content:<20MB>`
    // request can't tie up a pool connection on an unbounded jsonb
    // scan. Genuine filter values are IDs / short enums / ISO
    // timestamps — well under this cap.
    if (val.length > 200) return null;
    return { col, val };
  })();

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const where = filter ? `WHERE ${quoteIdent(filter.col)} = $1` : '';
      const params = filter ? [filter.val] : [];
      // Round 32: cap at 5000 rows. Prior state was unbounded — a
      // tables that accumulates over time (chatbot_leads has no
      // retention job) would eventually hit the 15s statement_timeout,
      // pin a pool connection through the whole wait, and cascade
      // into pool exhaustion + /api/health timeouts + ALB
      // deregistration. Matches the GENERIC_LIST_HARD_CAP already
      // enforced by genericListInPg in admin-writes.ts.
      const sql = `SELECT * FROM public.${quoteIdent(table)} ${where} ORDER BY ${quoteIdent(orderBy)} ${direction} LIMIT 5000`;
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
  // Round 31: R29 wired assertSameOrigin on the customer twins; this
  // is the widest-blast-radius admin write endpoint (25 allow-listed
  // tables: menus, pages, posts, legal_pages, categories, config
  // tables including payment_providers_config, chatbot_leads, ...).
  // A CSRF POST while an admin cookie was live could insert rows in
  // the operator's name across any of them.
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
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
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
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

// Tables whose self-referential parent_id should cascade-delete to
// children on parent DELETE. The /admin UIs for these tables already
// promise the cascade in their confirm modals ("이 메뉴와 모든 서브메뉴가
// 삭제됩니다" / "이 카테고리와 모든 서브카테고리가 삭제됩니다") — without
// the cascade those subrows were left orphaned with a dangling parent_id.
// `categories` has its own dedicated route at /api/admin/categories
// (see that file's custom DELETE) so it's NOT included here — the
// crud-route cascade is just for the tables routed exclusively through
// this generic endpoint, which today is `menus`.
const CASCADE_PARENT_ID_TABLES = new Set<string>(['menus']);

export async function DELETE(req: Request, { params }: Ctx) {
  const csrf = assertSameOrigin(req);
  if (csrf) return csrf;
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
      // Round 31: track rowCount from the parent DELETE so an
      // already-gone id (parallel-operator delete race, stale row
      // in the list, wrong id) surfaces as 404 instead of the
      // prior "success" that let the operator diverge from server
      // state. Matches the pattern makeAdminTableRoute uses.
      let parentRowCount = 0;
      if (CASCADE_PARENT_ID_TABLES.has(table)) {
        // Transactional cascade — children first, then parent. If the
        // parent delete fails the whole thing rolls back so we don't
        // leave a broken half-state where the children are gone but
        // the parent stayed.
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query(
            `DELETE FROM public.${quoteIdent(table)} WHERE parent_id = $1`,
            [id],
          );
          const parentResult = await client.query(
            `DELETE FROM public.${quoteIdent(table)} WHERE id = $1`,
            [id],
          );
          parentRowCount = parentResult.rowCount ?? 0;
          await client.query('COMMIT');
        } catch (err) {
          await client.query('ROLLBACK').catch(() => { /* connection may be gone */ });
          throw err;
        } finally {
          client.release();
        }
      } else {
        const { rowCount } = await pool.query(
          `DELETE FROM public.${quoteIdent(table)} WHERE id = $1`,
          [id],
        );
        parentRowCount = rowCount ?? 0;
      }
      if (parentRowCount === 0) {
        return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error(`[admin/crud/${table}] pg delete failed:`, err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  // Supabase fallback (dev / pre-cutover). Mirror the cascade so dev
  // behavior matches prod — keeps test data clean.
  if (CASCADE_PARENT_ID_TABLES.has(table)) {
    await supabase.from(table).delete().eq('parent_id', id);
  }
  const { error } = await supabase.from(table).delete().eq('id', id);
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
