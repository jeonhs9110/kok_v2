import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth/requireAdmin';

/**
 * instagram_config is a singleton row. Same shape as shorts-config.
 *
 * 2026-06-29: added `rss_feed_url`. useInstagram.saveConfig sends
 * `{ handle, description, rss_feed_url }` — the `rss_feed_url` was
 * silently dropped by this allow-list, so every time the operator
 * pasted a new RSS feed URL and clicked Save, the column stayed at
 * the old value (or NULL). Then clicking "Instagram 새로고침" called
 * /api/instagram/refresh which reads the same column → "RSS feed URL
 * is not configured" error or a refresh against the wrong feed.
 *
 * Direct user complaint: operator sets the URL, can't refresh posts.
 */
const ALLOWED = [
  'handle', 'description', 'rss_feed_url',
  'bg_type', 'bg_color', 'bg_media_url', 'bg_media_type',
  'header_font_size', 'header_text_color', 'header_bg_color',
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
      `SELECT * FROM public.instagram_config ORDER BY id ASC LIMIT 1`,
    );
    return NextResponse.json({ row: rows[0] ?? null });
  } catch (err) {
    console.error('[api/admin/instagram-config GET] failed:', err);
    return NextResponse.json({ error: 'load_failed' }, { status: 500 });
  }
}

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
    const existing = await pool.query<{ id: number }>(
      `SELECT id FROM public.instagram_config LIMIT 1`,
    );
    if (existing.rows[0]) {
      // Check the rowCount-derived boolean — genericUpdateInPg returns
      // false if the WHERE id = $1 matched zero rows (the row got
      // deleted between our SELECT above and this UPDATE). Previously
      // we discarded the boolean and replied { ok: true } even on a
      // 0-row update — operator saw success, but instagram config
      // wasn't actually saved. Throw so the catch below returns 500.
      const { genericUpdateInPg } = await import('@/lib/db/admin-writes');
      const updated = await genericUpdateInPg('instagram_config', String(existing.rows[0].id), payload);
      if (!updated) throw new Error('instagram_config_update_no_rows');
    } else {
      const { genericInsertInPg } = await import('@/lib/db/admin-writes');
      const inserted = await genericInsertInPg('instagram_config', payload);
      if (!inserted) throw new Error('instagram_config_insert_failed');
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[api/admin/instagram-config PUT] failed:', err);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }
}
