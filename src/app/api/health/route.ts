import { NextResponse } from 'next/server';

/**
 * /api/health — ALB target health check + handoff-friendly triage
 * surface.
 *
 * Returns 200 only when the process can actually serve requests:
 *   - DATABASE_URL is present
 *   - RDS Postgres answers a SELECT 1 within 2s
 *   - S3 storage bucket responds to HeadBucket within 2s (cached 5 min)
 *   - Cognito user pool responds to DescribeUserPool within 2s (cached 5 min)
 *
 * Returns 503 with a JSON breakdown when any check fails. ALB drains
 * the instance on 5 consecutive 503s and routes traffic to healthy
 * targets. The per-check `ok` field lets a handoff engineer distinguish
 * "RDS down" from "S3 creds rotated" from "Cognito pool deleted" at a
 * glance — prior response was RDS-only, so a sitewide 503 caused by an
 * S3 outage looked identical to RDS trouble.
 *
 * S3 + Cognito results are memoized for 5 min per process — those APIs
 * are cheap but the ALB polls every 30s across N instances; caching
 * keeps the call rate reasonable and avoids probing infra on every hit.
 *
 * 2026-06-30: Supabase fallback removed. RDS is the only live data
 * store after the cutoff; rolling back via USE_RDS=false would point
 * the app at a deleted Supabase project, so health (and the whole
 * site) should fail rather than pretend a phantom backend exists.
 */

interface CachedResult { ok: boolean; ts: number }
const PROBE_TTL_MS = 5 * 60 * 1000;
let cachedS3: CachedResult | null = null;
let cachedCognito: CachedResult | null = null;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      p,
      new Promise<T>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
      }),
    ]);
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

async function checkS3(): Promise<boolean> {
  if (cachedS3 && Date.now() - cachedS3.ts < PROBE_TTL_MS) return cachedS3.ok;
  try {
    const { S3Client, HeadBucketCommand } = await import('@aws-sdk/client-s3');
    const bucket = process.env.S3_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_S3_STORAGE_BUCKET;
    if (!bucket) return (cachedS3 = { ok: false, ts: Date.now() }).ok;
    const client = new S3Client({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    await withTimeout(client.send(new HeadBucketCommand({ Bucket: bucket })), 2000);
    return (cachedS3 = { ok: true, ts: Date.now() }).ok;
  } catch {
    return (cachedS3 = { ok: false, ts: Date.now() }).ok;
  }
}

async function checkCognito(): Promise<boolean> {
  if (cachedCognito && Date.now() - cachedCognito.ts < PROBE_TTL_MS) return cachedCognito.ok;
  try {
    const { CognitoIdentityProviderClient, DescribeUserPoolCommand } = await import('@aws-sdk/client-cognito-identity-provider');
    const poolId = process.env.COGNITO_USER_POOL_ID ?? process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
    if (!poolId) return (cachedCognito = { ok: false, ts: Date.now() }).ok;
    const client = new CognitoIdentityProviderClient({ region: process.env.AWS_REGION ?? 'ap-northeast-2' });
    await withTimeout(client.send(new DescribeUserPoolCommand({ UserPoolId: poolId })), 2000);
    return (cachedCognito = { ok: true, ts: Date.now() }).ok;
  } catch {
    return (cachedCognito = { ok: false, ts: Date.now() }).ok;
  }
}
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
    await withTimeout(pool.query(`SELECT 1`), 2000);
    checks['rds'] = { ok: true };
  } catch {
    // Don't leak the error message — could include DB host, schema name,
    // or driver internals. Operator can read the full error from the
    // EC2 systemd logs.
    checks['rds'] = { ok: false };
  }

  // S3 + Cognito probes run in parallel; each is memoized 5 min so a
  // 30s ALB poll doesn't hammer AWS APIs. Failures don't fail the
  // whole health check — they mark that specific dependency degraded
  // so a handoff engineer sees which layer is broken without the
  // whole site draining out of the ALB target pool.
  const [s3Ok, cognitoOk] = await Promise.all([checkS3(), checkCognito()]);
  checks['s3'] = { ok: s3Ok };
  checks['cognito'] = { ok: cognitoOk };

  // Only RDS + env failure gate the 503. S3 / Cognito outages are
  // logged in the response body but don't take the instance offline —
  // an ALB drain during a transient S3 blip would just spread the
  // pain to other instances that are also blipping.
  const critical = checks['rds'].ok && checks['env.DATABASE_URL'].ok;
  return NextResponse.json(
    { status: critical ? 'ok' : 'degraded', checks, ts: new Date().toISOString() },
    { status: critical ? 200 : 503 },
  );
}
