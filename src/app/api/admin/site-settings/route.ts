import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const VALID_KEY = /^[a-z0-9_]{1,64}$/i;

/**
 * GET /api/admin/site-settings?keys=a,b,c → { values: { a: ..., b: ... } }
 * Returns the raw stored value (string OR jsonb) per key. Empty / unset
 * keys come back as null.
 */
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const raw = new URL(req.url).searchParams.get('keys') ?? '';
  const keys = raw.split(',').map(k => k.trim()).filter(k => VALID_KEY.test(k));
  if (keys.length === 0) return NextResponse.json({ values: {} });

  if (process.env.USE_RDS === 'true') {
    try {
      const { getSiteSettingsFromPg } = await import('@/lib/db/storefront-reads');
      const values = await getSiteSettingsFromPg(keys);
      return NextResponse.json({ values });
    } catch (err) {
      console.error('[admin/site-settings] pg read failed:', err);
      return NextResponse.json({ values: {} }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ values: {} }, { status: 500 });
  const { data } = await supabase.from('site_settings').select('key, value').in('key', keys);
  const out = Object.fromEntries(keys.map(k => [k, null as unknown]));
  for (const r of data ?? []) out[r.key] = r.value;
  return NextResponse.json({ values: out });
}

/**
 * POST /api/admin/site-settings { items: [{key, value}] }
 * Upserts one or more site_settings rows. Values are stored as TEXT
 * (the column is text, with most callers JSON.stringify-ing structured
 * payloads first).
 */
export async function POST(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { items } = body as { items?: Array<{ key?: string; value?: string }> };
  if (!Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ ok: false, error: 'items required' }, { status: 400 });
  }

  const clean: Array<{ key: string; value: string }> = [];
  for (const it of items) {
    if (!it.key || !VALID_KEY.test(it.key)) continue;
    if (typeof it.value !== 'string') continue;
    clean.push({ key: it.key, value: it.value });
  }
  if (clean.length === 0) {
    return NextResponse.json({ ok: false, error: 'no valid items' }, { status: 400 });
  }

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const now = new Date();
      // One transaction over all upserts so a mid-loop failure
      // rolls back cleanly. Prior code issued N sequential
      // pool.query calls with no BEGIN — a network blip on the 3rd
      // of 4 keys left site_settings in a torn state where some
      // keys got the new value and others didn't, which is worse
      // than either state alone.
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const it of clean) {
          await client.query(
            `INSERT INTO public.site_settings (key, value, updated_at)
               VALUES ($1, $2, $3)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = EXCLUDED.updated_at`,
            [it.key, it.value, now],
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK').catch(() => { /* connection may be gone */ });
        throw err;
      } finally {
        client.release();
      }
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[admin/site-settings] pg upsert failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const nowIso = new Date().toISOString();
  const { error } = await supabase
    .from('site_settings')
    .upsert(clean.map(it => ({ key: it.key, value: it.value, updated_at: nowIso })), { onConflict: 'key' });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}
