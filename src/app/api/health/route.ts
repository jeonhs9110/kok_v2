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
  // Probe RDS reachability without revealing row counts. The previous
  // success response leaked `detail: 'count=5'` from the products
  // table; an attacker hitting this endpoint repeatedly could infer
  // catalog growth + schema changes from the trend line. ALB only
  // needs HTTP 200 vs 503 to drain the target.
  try {
    const { getPgPool } = await import('@/lib/db/pool');
    const pool = getPgPool();
    const ping = pool.query(`SELECT 1`);
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        ping,
        new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error('timeout after 2s')), 2000);
        }),
      ]);
    } finally {
      if (timeoutId) clearTimeout(timeoutId);
    }
    checks['rds'] = { ok: true };
  } catch {
    // Don't leak the error message — could include DB host, schema name,
    // or driver internals. Operator can read the full error from the
    // EC2 systemd logs.
    checks['rds'] = { ok: false };
  }

  const allOk = Object.values(checks).every(c => c.ok);
  return NextResponse.json(
    { status: allOk ? 'ok' : 'degraded', checks, ts: new Date().toISOString() },
    { status: allOk ? 200 : 503 },
  );
}
