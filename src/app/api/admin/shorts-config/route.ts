import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

/**
 * shorts_config is a singleton row (one config record total). The
 * makeAdminTableRoute factory assumes per-row CRUD; here we expose
 * GET (return the single row) + PUT (upsert it).
 */
const ALLOWED = [
  'bg_type', 'bg_color', 'bg_media_url', 'bg_media_type',
  'header_text', 'header_font_size', 'header_text_color', 'header_bg_color',
] as const;

function pickAllowed(body: unknown): Record<string, unknown> {
  if (!body || typeof body !== 'object') return {};
  const out: Record<string, unknown> = {};
  for (const k of ALLOWED) {
    if (Object.hasOwn(body as Record<string, unknown>, k)) {
      out[k] = (body as Record<string, unknown>)[k];
    }
  }
  return out;
}

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { getPgPool } = await import('@/lib/db/pool');
    const { rows } = await getPgPool().query(
      `SELECT * FROM public.shorts_config ORDER BY id ASC LIMIT 1`,
    );
    return NextResponse.json({ row: rows[0] ?? null });
  } catch (err) {
    console.error('[api/admin/shorts-config GET] failed:', err);
    return NextResponse.json({ error: 'load_failed' }, { status: 500 });
  }
}

/**
 * Upsert the singleton row. Re-uses an existing row's id when one is
 * present, otherwise inserts. Either path yields the same end-state.
 */
export async function PUT(request: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const payload = pickAllowed(body);
  if (Object.keys(payload).length === 0) {
    return NextResponse.json({ error: 'no_allowed_fields' }, { status: 400 });
  }
  try {
    const { getPgPool } = await import('@/lib/db/pool');
    const pool = getPgPool();
    const existing = await pool.query<{ id: string }>(
      `SELECT id FROM public.shorts_config LIMIT 1`,
    );
    if (existing.rows[0]) {
      const { genericUpdateInPg } = await import('@/lib/db/admin-writes');
      await genericUpdateInPg('shorts_config', existing.rows[0].id, payload);
    } else {
      const { genericInsertInPg } = await import('@/lib/db/admin-writes');
      await genericInsertInPg('shorts_config', payload);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/admin/shorts-config PUT] failed:', err);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
