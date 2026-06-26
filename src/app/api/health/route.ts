import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * /api/health — ALB target health check.
 *
 * Returns 200 only when the process can actually serve requests:
 *   - Required env vars are present for whichever backend is live
 *   - That backend is reachable on a HEAD-only count query
 *
 * Dispatches on USE_RDS: pings RDS via pg when true, Supabase otherwise.
 * Returns 503 with a JSON breakdown when any check fails. ALB drains
 * the instance on 5 consecutive 503s and routes traffic to healthy
 * targets.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  if (process.env.USE_RDS === 'true') {
    const dbUrl = process.env.DATABASE_URL;
    checks['env.DATABASE_URL'] = { ok: !!dbUrl, ...(dbUrl ? {} : { detail: 'missing' }) };
    if (!dbUrl) {
      return NextResponse.json(
        { status: 'degraded', checks, ts: new Date().toISOString() },
        { status: 503 },
      );
    }
    try {
      const { getPgPool } = await import('@/lib/db/pool');
      const pool = getPgPool();
      const ping = pool.query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM public.products`);
      const timed = (await Promise.race([
        ping,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout after 2s')), 2000)),
      ])) as { rows: Array<{ n: string }> };
      checks['rds.products'] = { ok: true, detail: `count=${timed.rows[0]?.n ?? '?'}` };
    } catch (err) {
      checks['rds.products'] = {
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  } else {
    const envVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;
    for (const v of envVars) {
      const present = !!process.env[v];
      checks[`env.${v}`] = { ok: present, ...(present ? {} : { detail: 'missing' }) };
    }
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anon) {
      checks['supabase.products'] = { ok: false, detail: 'skipped: env not set' };
      return NextResponse.json(
        { status: 'degraded', checks, ts: new Date().toISOString() },
        { status: 503 },
      );
    }
    try {
      const sb = createClient(url, anon, { auth: { persistSession: false } });
      const ping = sb.from('products').select('id', { count: 'exact', head: true });
      const timed = (await Promise.race([
        ping,
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout after 2s')), 2000)),
      ])) as { error?: { message: string } | null };
      if (timed.error) throw timed.error;
      checks['supabase.products'] = { ok: true };
    } catch (err) {
      checks['supabase.products'] = {
        ok: false,
        detail: err instanceof Error ? err.message : String(err),
      };
    }
  }

  const allOk = Object.values(checks).every(c => c.ok);
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
