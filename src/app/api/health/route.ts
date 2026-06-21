import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * /api/health — ALB target health check.
 *
 * Returns 200 only when the process can actually serve requests:
 *   - All required env vars are present (NEXT_PUBLIC_SUPABASE_URL etc.)
 *   - Supabase reachable on a HEAD-only count query (no auth, public table)
 *
 * Returns 503 with a JSON breakdown when any check fails. ALB drains the
 * instance on 5 consecutive 503s and routes traffic to healthy targets.
 *
 * Audit 2026-06-21: before this, ALB target health = "process is alive".
 * If the Supabase URL was wrong or the project paused, the instance still
 * reported healthy and every customer request 503'd silently.
 *
 * Audit 2026-06-22: fail fast when env is missing — previously we'd
 * still attempt a Supabase ping with empty URL/key, hit the catch with
 * "Invalid URL" and report Supabase as degraded. The env error is the
 * real signal; the misleading Supabase failure was noise.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; detail?: string }> = {};

  // Env presence — every NEXT_PUBLIC_ * is inlined at build time, so a
  // missing value here means the build was wrong, not the runtime.
  const envVars = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;
  for (const v of envVars) {
    const present = !!process.env[v];
    checks[`env.${v}`] = { ok: present, ...(present ? {} : { detail: 'missing' }) };
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // Fail fast — skip the Supabase ping entirely so the JSON reports
    // exactly which env is missing without a misleading "supabase ping
    // failed: Invalid URL" entry burying the real cause.
    checks['supabase.products'] = { ok: false, detail: 'skipped: env not set' };
    return NextResponse.json(
      { status: 'degraded', checks, ts: new Date().toISOString() },
      { status: 503 },
    );
  }

  // Supabase reachability — a HEAD count against a public table. Cheap,
  // doesn't carry RLS-restricted data, doesn't need the service role.
  try {
    const sb = createClient(url, anon, { auth: { persistSession: false } });
    // products is public-readable + small enough for HEAD to be fast.
    // Wrap in a 2s timeout so a stalled DB doesn't hang the health probe.
    const ping = sb.from('products').select('id', { count: 'exact', head: true });
    const timed = (await Promise.race([
      ping,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('timeout after 2s')), 2000),
      ),
    ])) as { error?: { message: string } | null };
    if (timed.error) throw timed.error;
    checks['supabase.products'] = { ok: true };
  } catch (err) {
    checks['supabase.products'] = {
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
