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
