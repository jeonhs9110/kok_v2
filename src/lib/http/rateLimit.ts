/**
 * Process-local per-IP rate limiter shared across the unauthenticated
 * auth + customer endpoints. Each EC2 instance keeps its own Map; a
 * customer who reaches the cap on one instance can still hit a fresh
 * cap on another instance after the ALB rotates them. That's
 * intentional — these limits are abuse brakes, not strict quotas. The
 * point is to stop a single source from flooding any one box.
 *
 * Usage:
 *
 *   const limiter = createRateLimiter({
 *     name: 'cognito_forgot_password',
 *     limit: 5,
 *     windowMs: 60 * 60 * 1000,
 *   });
 *   if (!limiter.check(getRequestIp(req))) {
 *     return NextResponse.json({ error: 'too_many_requests' }, { status: 429 });
 *   }
 *
 * Memory: each named limiter holds its own Map; old entries are
 * dropped on the next access whose window has rolled. Worst-case
 * footprint is roughly (RATE_LIMIT × distinct IPs per window) entries
 * per limiter, which is fine for the unauthenticated paths that we
 * gate.
 */

import type { NextRequest } from 'next/server';

interface RateLimiterOptions {
  /** Stable identifier — used only for log messages today. */
  name: string;
  /** Max successful checks per IP per window. */
  limit: number;
  /** Window length in milliseconds. */
  windowMs: number;
}

interface Entry {
  count: number;
  resetAt: number;
}

export interface RateLimiter {
  check(ip: string): boolean;
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const store = new Map<string, Entry>();
  return {
    check(ip: string): boolean {
      const now = Date.now();
      const entry = store.get(ip);
      if (!entry || now > entry.resetAt) {
        store.set(ip, { count: 1, resetAt: now + opts.windowMs });
        return true;
      }
      if (entry.count >= opts.limit) {
        // Logging is cheap and the warn helps when CloudWatch sees a
        // spike — name distinguishes which limiter tripped. IP is
        // truncated to the /24 prefix so CloudWatch line doesn't
        // carry a plaintext PII-flavoured identifier (analytics also
        // salt-hashes IPs before storing — the log posture should
        // match). JSON-shaped so a metric filter can key on `event`.
        console.warn(JSON.stringify({
          event: 'rate_limit.capped',
          limiter: opts.name,
          ip_prefix: maskIp(ip),
          count: entry.count,
        }));
        return false;
      }
      entry.count++;
      return true;
    },
  };
}

/**
 * Truncate an IPv4 to its /24 prefix (last octet blanked) or an IPv6
 * to its /64. Used before logging so CloudWatch never receives the
 * plaintext client IP — matches the salt-hashing posture the analytics
 * pipeline (src/app/api/track/route.ts) already uses for the DB row.
 * The prefix is still uniqueish enough to cluster abuse spikes.
 */
export function maskIp(ip: string): string {
  if (!ip || ip === 'unknown') return 'unknown';
  if (ip.includes(':')) {
    const parts = ip.split(':').slice(0, 4);
    return parts.join(':') + '::x';
  }
  const parts = ip.split('.');
  if (parts.length !== 4) return 'unknown';
  return `${parts[0]}.${parts[1]}.${parts[2]}.x`;
}

/**
 * Pull the visitor's real IP out of the ALB-forwarded headers. Matches
 * the same logic /api/track uses so the rate limit and the analytics
 * row hash from the same source.
 */
export function getRequestIp(req: Request | NextRequest): string {
  const xff = (req as NextRequest).headers.get('x-forwarded-for');
  if (xff) {
    const first = xff.split(',')[0]?.trim();
    if (first) return first;
  }
  return (req as NextRequest).headers.get('x-real-ip') || 'unknown';
}
