import { NextResponse } from 'next/server';

/**
 * /api/health — ALB target health check.
 *
 * Returns 200 only when the process can actually serve requests:
 *   - DATABASE_URL is present
 *   - RDS Postgres answers a HEAD-only count query within 2s
 *
 * Returns 503 with a JSON breakdown when any check fails. ALB drains
 * the instance on 5 consecutive 503s and routes traffic to healthy
 * targets.
 *
 * 2026-06-30: Supabase fallback removed. RDS is the only live data
 * store after the cutoff; rolling back via USE_RDS=false would point
 * the app at a deleted Supabase project, so health (and the whole
 * site) should fail rather than pretend a phantom backend exists.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

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

  const allOk = Object.values(checks).every(c => c.ok);
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
