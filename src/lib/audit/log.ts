/**
 * Structured audit log for the PIPA-critical events that Dynamic
 * Solution's operator will need to answer after handoff:
 *
 *   - Who deleted this customer account?
 *   - Who promoted this user to admin (and when)?
 *   - Who exported the full customer CSV last week?
 *   - Did the customer's account-delete flow actually anonymize
 *     their posts + comments?
 *
 * No dedicated table, no infrastructure change — just `console.log`
 * with a consistent JSON shape that lands in EC2 stdout and gets
 * shipped to CloudWatch by the systemd journal → CloudWatch agent.
 * That makes the events queryable via CloudWatch Logs Insights
 * without introducing an RDS table (which would itself need audit
 * cleanup / retention) or a new SNS topic.
 *
 * Query shape (CloudWatch Logs Insights):
 *
 *   fields @timestamp, @message
 *   | filter @message like /"audit":true/
 *   | filter event = "customer.account.deleted"
 *   | sort @timestamp desc
 *   | limit 100
 *
 * This log is INTENTIONALLY minimal:
 *   - No customer email in plaintext — a hash so an operator can
 *     confirm a specific email without the log line itself being a
 *     PII exposure surface.
 *   - No password, token, or API key material (would-be violation
 *     of PIPA Article 29 + our own security posture).
 *   - Numeric row counts (posts, comments, reviews) so the operator
 *     can verify anonymization actually ran.
 *
 * Distinct from `console.error` — audit logs are INFO-level events
 * about *expected* actions we want the trail for, not errors.
 */
import { createHash } from 'crypto';

export type AuditEvent =
  | 'customer.account.deleted'
  | 'customer.profile.updated'
  | 'admin.user.role_changed'
  | 'admin.user.deleted'
  | 'admin.users.csv_exported';

interface AuditPayload {
  /** Cognito sub of the person who took the action; null for system. */
  actor: string | null;
  /** Cognito sub / row id / etc. of the entity affected. */
  target?: string | null;
  /** 'success' | 'failure' | 'partial' (e.g., RDS ok but Cognito sync failed) */
  outcome: 'success' | 'failure' | 'partial';
  /** Event-specific counts + flags. Keep small — CloudWatch line limit. */
  metadata?: Record<string, string | number | boolean | null>;
}

/**
 * Emit an audit event. Never throws — a failing audit write must not
 * take down the operation it's logging. The whole thing runs inside a
 * try/catch as a belt-and-suspenders guard.
 */
export function auditLog(event: AuditEvent, payload: AuditPayload): void {
  try {
    const record = {
      audit: true,
      event,
      ts: new Date().toISOString(),
      ...payload,
    };
    // Single line so CloudWatch treats it as one event. stdout, not
    // stderr — audit success is not an error.
    console.log(JSON.stringify(record));
  } catch (err) {
    // Absolute last resort — even the JSON.stringify shouldn't fail
    // given the payload shape, but we defend so an audit log crash
    // never propagates into a customer-facing error.
    console.error('[audit] emit failed:', err instanceof Error ? err.message : String(err));
  }
}

/**
 * Hash an email for use in the `target_email_hash` metadata field.
 * Truncated so the log line stays compact but still lets the operator
 * confirm "is this the row for foo@bar.com" by running the same hash
 * on their side. Not for security — the intent is convenience without
 * writing the email in plaintext.
 */
export function hashEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return createHash('sha256').update(email.toLowerCase().trim()).digest('hex').slice(0, 12);
}
