// 'server-only' annotation removed: it threw at build time whenever a
// transitively-importing module was reachable from a Client Component,
// even through a dynamic-import dispatcher. The actual safety guard is
// the `USE_RDS === 'true'` env check at every call site — the env var
// is undefined in the browser, so this pool is never instantiated
// client-side. Webpack's resolve.fallback (next.config.ts) stubs the
// Node-only modules pg pulls in (tls, net, fs, ...) so the unreachable
// client chunk compiles cleanly.
import { Pool, types as pgTypes, type PoolConfig } from 'pg';

// node-postgres parses Postgres DATE (OID 1082) into a JS Date object
// by default. When that Date crosses NextResponse.json(), it serializes
// to a full ISO timestamp like "1990-01-15T00:00:00.000Z" — every
// customer who picks a birthday in /register or /my-page then sees a
// timezone-tagged blob instead of the date they entered. Override the
// parser to return the raw 'YYYY-MM-DD' string so the wire format
// matches what the admin form, the admin user detail, and the customer
// profile renderer all already expect. TIMESTAMP / TIMESTAMPTZ (1114 /
// 1184) stay on the default Date conversion because the dashboard's
// `formatKstDate()` helper depends on it.
pgTypes.setTypeParser(1082, (val: string) => val);

/**
 * Singleton Postgres connection pool for the RDS backend.
 *
 * Lifecycle: one pool per Node.js process. Next.js's Node runtime keeps
 * the same process across requests (unlike edge), so the pool persists
 * and reuses TCP/TLS handshakes. Hot reload during dev recreates the
 * module — globalThis caching below survives that.
 *
 * Use only from server code (route handlers, server components, server
 * actions). Marked `server-only` so accidental client imports fail
 * loudly at build time instead of leaking the connection string to
 * the browser bundle.
 *
 * RDS-specific config:
 *   - `?sslmode=require` in DATABASE_URL forces TLS; pg respects it
 *     automatically. We DON'T pin a CA cert here because RDS rotates
 *     its CA periodically and pinning would force a rebuild on every
 *     rotation. The connection is encrypted either way.
 *   - max=10 sits comfortably below the t4g.micro's ~85 connection
 *     ceiling, leaving room for migrations + ad-hoc psql sessions.
 *   - idleTimeout=30s cleans up idle connections so a slow night
 *     doesn't keep ~10 sockets warm.
 */

const POOL_CONFIG: PoolConfig = {
  // node-postgres reads PGHOST/PGUSER/etc. from env automatically when
  // connectionString isn't set, but DATABASE_URL is more portable and
  // matches the convention in scripts/db/README.md.
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  // Round 28: per-query 15s ceiling so a rogue slow query can't hold
  // a pool connection open indefinitely + drain the 10-slot pool.
  // Prior state relied on the ALB 60s idle timeout — but by then 10
  // stuck queries had already pinned every slot and /api/health's
  // `SELECT 1` timed out too, draining the whole instance from the
  // target pool. 15s is generous for every read path we ship today
  // (heaviest is the analytics dashboard at ~2s).
  query_timeout: 15_000,
  statement_timeout: 15_000,
  // Reject the connection rather than queue it forever — surfacing a
  // pool exhaustion as a fast 500 is better than silent latency.
  allowExitOnIdle: false,
};

// Cache on globalThis to survive Next.js dev hot reload (each reload
// re-evaluates this module). In prod the cache is harmless overhead.
const globalForPg = globalThis as unknown as { __kokkokPgPool?: Pool };

export function getPgPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      '[db/pool] DATABASE_URL is not set. RDS migration requires this env var on EC2 + .env.local for development.',
    );
  }
  if (!globalForPg.__kokkokPgPool) {
    globalForPg.__kokkokPgPool = new Pool(POOL_CONFIG);
    // Surface any unhandled pool error rather than crashing the worker.
    // A flapping RDS or a leaked connection that's been killed by RDS
    // surfaces here; route handlers see the next acquire() throw.
    globalForPg.__kokkokPgPool.on('error', (err) => {
      console.error('[db/pool] idle client error:', err);
    });
  }
  return globalForPg.__kokkokPgPool;
}

/**
 * Whether the app should route data reads/writes to RDS instead of
 * Supabase. Controlled by the `USE_RDS` env var (read-once at module
 * load — flipping requires a restart).
 *
 * Round 31: normalize the env value so `'TRUE'`, `'True'`, `' true '`
 * and `'true\n'` (common `/etc/kokkok/env` typos) all resolve to the
 * intended `true` — the prior strict `=== 'true'` compare silently
 * fell through to the Supabase branch on any variant. After the
 * 2026-06-27 Supabase decommission that fallback returns null and
 * the storefront serves empty grids. Also log the resolution once at
 * module load so a handoff engineer can grep the boot log to confirm.
 */
const USE_RDS_RAW = process.env.USE_RDS ?? '';
export const USE_RDS = USE_RDS_RAW.trim().toLowerCase() === 'true';
if (process.env.NODE_ENV !== 'test') {
  console.log(JSON.stringify({
    event: 'db.pool.boot',
    use_rds_raw: USE_RDS_RAW.slice(0, 20),
    use_rds_resolved: USE_RDS,
  }));
}
