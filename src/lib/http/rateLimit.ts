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
        // spike — name distinguishes which limiter tripped.
        console.warn(`[rate-limit:${opts.name}] capped ip=${ip} count=${entry.count}`);
        return false;
      }
      entry.count++;
      return true;
    },
  };
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
