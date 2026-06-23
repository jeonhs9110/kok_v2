import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import geoip from 'geoip-country';
import { categorizeReferrer, extractSearchKeyword } from '@/lib/analytics/referrer';

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
    if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });

    const { path, referrer, search } = await req.json();

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
      const lookup = geoip.lookup(ip);
      country = lookup?.country || null;
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

    // 5s timeout — a stalled Supabase would otherwise block this route
    // indefinitely and starve EC2 worker threads. The insert is
    // best-effort analytics; dropping a row when the DB is slow is
    // strictly better than backing up the request queue.
    const insert = supabase.from('analytics').insert([{
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
    }]);

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
