import { NextResponse, type NextRequest } from 'next/server';
import { createRateLimiter, getRequestIp, maskIp } from '@/lib/http/rateLimit';

/**
 * POST /api/csp-report
 *
 * Sink for browser-emitted Content-Security-Policy violation reports.
 * Both the legacy `application/csp-report` shape (Chrome/Safari) and
 * the newer `application/reports+json` Reporting API v1 shape
 * (Firefox + Chrome future) are accepted; both get normalized to a
 * single structured warn line for CloudWatch Insights triage.
 *
 * Rollout in Round 24 is CSP-Report-Only, so this endpoint receives
 * every would-be violation without the browser actually blocking
 * anything. Once the log settles to zero after ~7 days, the header
 * flips to enforcing mode in a separate one-line PR.
 *
 * Rate limit: 30 reports per masked IP per 5 min. A misconfigured
 * page can fire hundreds of reports per navigation and the endpoint
 * is unauthenticated by design (browsers can't send credentials on
 * report POSTs); the brake stops one bad tab from filling CloudWatch
 * ingest.
 */

const reportLimiter = createRateLimiter({
  name: 'csp_report',
  limit: 30,
  windowMs: 5 * 60 * 1000,
});

// Legacy csp-report shape: { "csp-report": { document-uri, referrer,
//   violated-directive, effective-directive, original-policy,
//   disposition, blocked-uri, ... } }
interface LegacyCspReport {
  'document-uri'?: string;
  'referrer'?: string;
  'violated-directive'?: string;
  'effective-directive'?: string;
  'blocked-uri'?: string;
  'source-file'?: string;
  'line-number'?: number;
  'column-number'?: number;
  'disposition'?: string;
  'status-code'?: number;
}

// Reporting API v1: [{ type: 'csp-violation', body: {...}, ... }]
interface ReportingApiEntry {
  type?: string;
  body?: {
    documentURL?: string;
    referrer?: string;
    effectiveDirective?: string;
    originalPolicy?: string;
    disposition?: string;
    blockedURL?: string;
    sourceFile?: string;
    lineNumber?: number;
    columnNumber?: number;
    statusCode?: number;
  };
}

export async function POST(request: NextRequest) {
  const ip = getRequestIp(request);
  if (!reportLimiter.check(ip)) {
    return new NextResponse(null, { status: 204 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return new NextResponse(null, { status: 204 });
  }

  // Both shapes coalesced into one flat record for CloudWatch. The
  // interesting fields for triage are: directive, blocked source,
  // and document URL. Everything else is noise that inflates ingest.
  try {
    if (Array.isArray(body)) {
      for (const entry of body as ReportingApiEntry[]) {
        if (entry.type !== 'csp-violation' || !entry.body) continue;
        emitViolation({
          event: 'csp.violation',
          shape: 'reporting-api',
          directive: entry.body.effectiveDirective ?? null,
          blocked: truncate(entry.body.blockedURL, 200),
          document: truncate(entry.body.documentURL, 200),
          source: truncate(entry.body.sourceFile, 200),
          disposition: entry.body.disposition ?? null,
          ip_prefix: maskIp(ip),
        });
      }
    } else if (body && typeof body === 'object' && 'csp-report' in body) {
      const r = (body as { 'csp-report': LegacyCspReport })['csp-report'];
      emitViolation({
        event: 'csp.violation',
        shape: 'legacy',
        directive: r['effective-directive'] ?? r['violated-directive'] ?? null,
        blocked: truncate(r['blocked-uri'], 200),
        document: truncate(r['document-uri'], 200),
        source: truncate(r['source-file'], 200),
        disposition: r['disposition'] ?? null,
        ip_prefix: maskIp(ip),
      });
    }
  } catch {
    // Never let a malformed report tank the endpoint.
  }

  // Always 204. Browsers don't care about the response body.
  return new NextResponse(null, { status: 204 });
}

function emitViolation(record: Record<string, string | number | null>): void {
  try {
    console.warn(JSON.stringify(record));
  } catch { /* never let logging break the reporter */ }
}

function truncate(value: string | undefined | null, max: number): string | null {
  if (!value) return null;
  return value.length > max ? value.slice(0, max) : value;
}
