import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { categorizeReferrer, extractSearchKeyword } from '@/lib/analytics/referrer';
import { createRateLimiter, getRequestIp } from '@/lib/http/rateLimit';

// Per-IP cap on analytics writes. A normal browsing session is < 100
// pageviews / 5min; the 300/5min threshold leaves a wide buffer for
// rapid-fire SPA navigations (the page tracker fires on every route
// change) while killing any scripted flood that targets this anonymous
// endpoint. Without the cap a single bot could fill the analytics
// table with arbitrary `path`/`referrer` strings, polluting the
// dashboard and growing the table unbounded.
const trackLimiter = createRateLimiter({
  name: 'track',
  limit: 300,
  windowMs: 5 * 60 * 1000,
});

// Hard caps for the operator-visible string columns so a malicious
// caller can't submit a 10MB path/referrer and balloon a row. Same
// 500/2000 split /api/admin/dashboard's aggregator assumes.
const MAX_PATH_LEN = 500;
const MAX_REFERRER_LEN = 2000;
const MAX_SEARCH_LEN = 2000;

// geoip-country is intentionally lazy-loaded — see geoipLookup() below.
// The package reads its own MaxMind binary database from its node_modules
// folder at module-evaluation time. When that file is missing in the EC2
// runtime (which has happened after a few deploys — the Next.js
// standalone bundle doesn't always copy the data file even with
// serverExternalPackages set), a top-level `import geoip from
// 'geoip-country'` throws BEFORE this route's handler ever runs.
// Next.js then surfaces a generic "Internal Server Error" with no JSON
// body — opaque to /api/track callers (PageTracker), starves the
// analytics dashboard, and silently breaks the top-viewed section.
// Lazy import + a tight try/catch keeps a missing data file from
// taking down the whole route; country falls through to 'UNKNOWN'
// the same way the dashboard already expects.
let geoipModule: typeof import('geoip-country') | null = null;
let geoipLoadFailed = false;
async function geoipLookup(ip: string): Promise<string | null> {
  if (geoipLoadFailed) return null;
  if (!geoipModule) {
    try {
      geoipModule = await import('geoip-country');
    } catch (err) {
      geoipLoadFailed = true;
      console.warn(
        '[track] geoip-country load failed — country resolution will fall back to UNKNOWN:',
        err instanceof Error ? err.message : String(err),
      );
      return null;
    }
  }
  try {
    return geoipModule.default.lookup(ip)?.country ?? null;
  } catch (err) {
    console.warn('[track] geoip lookup threw for ip:', err instanceof Error ? err.message : String(err));
    return null;
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

// Warn ONCE per cold start if the salt isn't configured. Falling back to
// a hardcoded literal makes the hash trivially reversible by anyone with
// the source — we don't want that to slip past silently.
const ANALYTICS_IP_SALT = process.env.ANALYTICS_IP_SALT || '';
if (!ANALYTICS_IP_SALT && supabaseUrl) {
  console.warn('[track] ANALYTICS_IP_SALT is not set; ip_hash will use a low-entropy fallback. Set the env var in EC2 user-data.');
}

/**
 * Resolve the visitor's real IP. Behind the ALB, the `x-forwarded-for`
 * header carries the chain `client, alb-internal-1, alb-internal-2…`.
 * The first entry is the real client IP. On the previous Vercel deploy
 * the same header was present with the same semantics, so this works
 * for both pre- and post-EC2 visits without conditionals.
 */
function getClientIp(req: NextRequest): string | null {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return req.headers.get('x-real-ip') || null;
}

/**
 * SHA-256 hash of `${ip}:${ANALYTICS_IP_SALT}`. With the salt set, the
 * hash is irreversible (can't rainbow-table 4 billion IPv4 without the
 * salt) AND uncorrelatable across deployments that rotate the salt.
 *
 * Without the salt — a sandboxed dev environment, a busted EC2 user-data
 * — we still hash with a low-entropy fallback (`'kokkok-noop-salt'`)
 * instead of using the Supabase project URL, which audit-flagged as
 * leaking deployment identity through correlatable hashes. The warn-on-
 * cold-start above makes the gap loud.
 */
function hashIp(ip: string): string {
  const salt = ANALYTICS_IP_SALT || 'kokkok-noop-salt';
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex');
}

const INSERT_TIMEOUT_MS = 5000;

/**
 * Coarse-grained device classification from the User-Agent. Three
 * buckets is enough to answer "how does mobile compare to desktop?"
 * — the question Korean DTC operators actually ask. Apple-tablet
 * lookup is explicit because iPadOS UA mimics macOS Safari and would
 * otherwise fall to desktop. Order matters: tablet check before
 * mobile so an iPad doesn't classify as mobile.
 */
function parseDeviceType(ua: string | null): 'mobile' | 'tablet' | 'desktop' {
  if (!ua) return 'desktop';
  if (/iPad|Tablet|PlayBook|Silk(?!.*Mobile)/i.test(ua)) return 'tablet';
  if (/Mobile|iPhone|iPod|Android.*Mobile|Windows Phone|BlackBerry|Opera Mini/i.test(ua)) return 'mobile';
  return 'desktop';
}

/**
 * Pull utm_source / utm_medium / utm_campaign from the landing URL's
 * search string (PageTracker sends window.location.search). Truncated
 * to 200 chars per field — long enough for any sane campaign tag,
 * short enough that a malformed query can't bloat the row.
 */
function extractUtm(search: string | null | undefined): {
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
} {
  if (!search) return { utm_source: null, utm_medium: null, utm_campaign: null };
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search);
  } catch {
    return { utm_source: null, utm_medium: null, utm_campaign: null };
  }
  const pick = (k: string) => {
    const v = params.get(k);
    return v && v.trim().length > 0 ? v.trim().slice(0, 200) : null;
  };
  return {
    utm_source: pick('utm_source'),
    utm_medium: pick('utm_medium'),
    utm_campaign: pick('utm_campaign'),
  };
}

export async function POST(req: NextRequest) {
  try {
    // RDS path doesn't need a supabase client; only block if BOTH paths
    // would have no destination.
    if (process.env.USE_RDS !== 'true' && !supabase) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    // Per-IP brake. A normal session is well under 300/5min; flooders
    // get a 429 and stop polluting the analytics table.
    if (!trackLimiter.check(getRequestIp(req))) {
      return NextResponse.json({ ok: false, error: 'too_many_requests' }, { status: 429 });
    }

    const body = await req.json();
    // Truncate string fields at the boundary. Without these caps a
    // malicious caller could submit a 10MB path/referrer and bloat the
    // row; the dashboard's aggregator + the table's storage cost don't
    // need anything past these limits to work.
    const path = typeof body.path === 'string' ? body.path.slice(0, MAX_PATH_LEN) : null;
    const referrer = typeof body.referrer === 'string' ? body.referrer.slice(0, MAX_REFERRER_LEN) : null;
    const search = typeof body.search === 'string' ? body.search.slice(0, MAX_SEARCH_LEN) : null;

    // Country resolution priority:
    //   1. x-vercel-ip-country header  — works on Vercel (preview/dev)
    //   2. x-user-country header        — present if a proxy injects it
    //   3. geoip-country MaxMind lookup — works on EC2 + ALB (the prod path).
    //      Previous behavior fell straight to 'UNKNOWN' here, which is
    //      why the dashboard's "알 수 없음" bucket grew so large after
    //      the move off Vercel.
    let country =
      req.headers.get('x-vercel-ip-country') ||
      req.headers.get('x-user-country') ||
      null;
    const ip = getClientIp(req);
    if (!country && ip) {
      country = await geoipLookup(ip);
    }
    if (!country) country = 'UNKNOWN';

    const ip_hash = ip ? hashIp(ip) : null;

    // Migration 45 (2026-06-24): categorize at write time so the
    // dashboard can group/filter without re-parsing every row. Both
    // columns are nullable — the dashboard still falls back to the
    // raw `referrer` text for pre-migration rows.
    const traffic_source = categorizeReferrer(referrer);
    const search_keyword = extractSearchKeyword(referrer, traffic_source);

    // Migration 46 (2026-06-24): mobile / desktop split + UTM tags.
    // ~80% of Korean DTC is mobile so the device split is non-optional
    // for the CEO view. UTM is what makes paid-vs-organic measurable;
    // without it both buckets collapse onto the same referrer host.
    const device_type = parseDeviceType(req.headers.get('user-agent'));
    const { utm_source, utm_medium, utm_campaign } = extractUtm(search);

    const payload = {
      country,
      path: path || '/',
      referrer: referrer || null,
      ip_hash,
      traffic_source,
      search_keyword,
      device_type,
      utm_source,
      utm_medium,
      utm_campaign,
    };

    // 5s timeout — a stalled DB would otherwise block this route
    // indefinitely and starve EC2 worker threads. The insert is
    // best-effort analytics; dropping a row when the DB is slow is
    // strictly better than backing up the request queue.
    const insert = (async () => {
      if (process.env.USE_RDS === 'true') {
        const { insertAnalyticsEventInPg } = await import('@/lib/db/admin-writes');
        await insertAnalyticsEventInPg(payload);
        return;
      }
      const { error } = await supabase!.from('analytics').insert([payload]);
      if (error) throw error;
    })();

    await Promise.race([
      insert,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('analytics insert timeout 5s')), INSERT_TIMEOUT_MS),
      ),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    // Was a silent `return { ok: false }` — anything from a malformed
    // request body to a Supabase outage produced the same response with
    // no log. Operator had no way to diagnose why country detection or
    // repeat-visitor counts had stopped working.
    console.error('[track] failed:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
