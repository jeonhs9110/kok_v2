import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireCustomer } from '@/lib/auth/requireCustomer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const ALLOWED_FIELDS = [
  'name', 'phone', 'gender', 'birthday', 'country', 'skin_type',
  'marketing_consent', 'email',
] as const;

/**
 * GET /api/customer/profile → the signed-in customer's profile row.
 */
export async function GET() {
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const { rows } = await pool.query(
        `SELECT * FROM public.customer_profiles WHERE id = $1 LIMIT 1`,
        [auth.userId],
      );
      return NextResponse.json({ profile: rows[0] ?? null });
    } catch (err) {
      console.error('[customer/profile] pg read failed:', err);
      return NextResponse.json({ profile: null }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ profile: null }, { status: 500 });
  const { data } = await supabase.from('customer_profiles').select('*').eq('id', auth.userId).maybeSingle();
  return NextResponse.json({ profile: data ?? null });
}

/**
 * PATCH /api/customer/profile { display_name?, phone?, address_kr?, birth_year? }
 * Upserts allow-listed columns on the customer's own row.
 */
export async function PATCH(req: Request) {
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const payload = body as Record<string, unknown>;

  const fields: Record<string, unknown> = {};
  for (const k of ALLOWED_FIELDS) {
    if (k in payload) fields[k] = payload[k];
  }
  if (Object.keys(fields).length === 0) {
    return NextResponse.json({ ok: false, error: 'no allowed fields' }, { status: 400 });
  }

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const cols = Object.keys(fields);
      const placeholders = cols.map((_, i) => `$${i + 2}`).join(', ');
      const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ');
      const values = cols.map(c => fields[c]);
      await pool.query(
        `INSERT INTO public.customer_profiles (id, ${cols.join(', ')})
           VALUES ($1, ${placeholders})
           ON CONFLICT (id) DO UPDATE SET ${sets}`,
        [auth.userId, ...values],
      );
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[customer/profile] pg upsert failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  const { error } = await supabase.from('customer_profiles').upsert({ id: auth.userId, ...fields });
  if (error) return NextResponse.json({ ok: false }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/**
 * DELETE /api/customer/profile — customer-initiated account deletion.
 * Removes the profile row. Does NOT delete the auth record (Cognito
 * account survives) — operator removes via /admin/users.
 */
export async function DELETE() {
  const auth = await requireCustomer();
  if (auth instanceof NextResponse) return auth;

  if (process.env.USE_RDS === 'true') {
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      await pool.query(`DELETE FROM public.customer_profiles WHERE id = $1`, [auth.userId]);
      return NextResponse.json({ ok: true });
    } catch (err) {
      console.error('[customer/profile] pg delete failed:', err);
      return NextResponse.json({ ok: false }, { status: 500 });
    }
  }

  if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });
  await supabase.from('customer_profiles').delete().eq('id', auth.userId);
  return NextResponse.json({ ok: true });
}
