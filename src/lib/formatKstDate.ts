/**
 * Render an ISO timestamp in Asia/Seoul with a visible "KST" suffix.
 *
 * Why centralized: every admin table renders created_at via
 * `toLocaleDateString('ko-KR')`, which uses the operator's browser
 * timezone. A row created at 11pm KST shifts a day for any operator on
 * a non-KST laptop, and there's no visual cue that timezones are even
 * in play. This helper fixes both — explicit Asia/Seoul + "KST" tag.
 *
 * Defensive: returns "—" for falsy / invalid timestamps so a stray null
 * doesn't show up as "Invalid Date" in the operator UI.
 */
export function formatKstDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' }) + ' KST';
}

export function formatKstDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }) + ' KST';
}

/**
 * Return the `YYYY-MM-DD` calendar date in Asia/Seoul for the given
 * moment (default: now). Everywhere in the admin surface that grouped
 * or filtered rows by "day" was previously using
 *   new Date(...).toISOString().slice(0, 10)
 * which yields the UTC calendar date — off by one for the 9-hour KST
 * window between 00:00 and 09:00 local time. A Korean operator opening
 * the analytics dashboard at 07:00 KST saw the previous day's number
 * in the "Today" bucket; a customer who registered at 08:00 KST on
 * Jan 2 landed in the CSV as `2026-01-01`.
 *
 * The `sv-SE` locale is a happy accident — it emits ISO-8601
 * `YYYY-MM-DD`, so we get the shape the admin queries need without
 * an extra `padStart` dance.
 */
export function kstDateString(input?: string | Date | number): string {
  const d = input === undefined ? new Date() : new Date(input);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
}
