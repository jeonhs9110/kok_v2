import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import geoip from 'geoip-country';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

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
 * SHA-256 hash of `${ip}:${ANALYTICS_IP_SALT}`. The salt makes the hash
 * irreversible (you can't rainbow-table 4 billion IPv4 addresses if you
 * don't know the salt) and uncorrelatable across deployments that
 * rotate the salt. Default salt is the project URL — fine as a fallback
 * for environments that haven't set ANALYTICS_IP_SALT yet, since the
 * URL is at least process-scoped not literal-default.
 */
function hashIp(ip: string): string {
  const salt = process.env.ANALYTICS_IP_SALT || supabaseUrl || 'kokkok-default-salt';
  return createHash('sha256').update(`${ip}:${salt}`).digest('hex');
}

export async function POST(req: NextRequest) {
  try {
    if (!supabase) return NextResponse.json({ ok: false }, { status: 500 });

    const { path, referrer } = await req.json();

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

    await supabase.from('analytics').insert([{
      country,
      path: path || '/',
      referrer: referrer || null,
      ip_hash,
    }]);

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
