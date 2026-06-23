/**
 * Shared referrer parsing for analytics — categorize an inbound URL
 * into a fixed bucket and extract the search keyword when it's a
 * search engine.
 *
 * Called from two places:
 *   - /api/track (server) at write time, to populate the
 *     traffic_source + search_keyword columns on every visit row.
 *   - /admin dashboard (client) at read time, both for legacy rows
 *     (without the new columns) and for live filtering / re-bucketing.
 *
 * Keep this file PURE — no DB, no React, no env reads. Anything that
 * needs to know "what does this referrer mean" goes through here so
 * we never get the server and the dashboard out of sync on the rules.
 */

export type TrafficSource =
  | 'google'
  | 'naver'
  | 'daum'
  | 'bing'
  | 'yahoo'
  | 'duckduckgo'
  | 'instagram'
  | 'facebook'
  | 'kakao'
  | 'twitter'
  | 'direct'
  | 'other';

export const TRAFFIC_SOURCE_LABEL: Record<TrafficSource, string> = {
  google: '구글',
  naver: '네이버',
  daum: '다음',
  bing: 'Bing',
  yahoo: 'Yahoo',
  duckduckgo: 'DuckDuckGo',
  instagram: '인스타그램',
  facebook: 'Facebook',
  kakao: '카카오',
  twitter: 'Twitter / X',
  direct: '직접 방문',
  other: '기타',
};

/** Sources whose URLs expose the search keyword in a query param. */
export const SEARCH_SOURCES: Set<TrafficSource> = new Set([
  'google', 'naver', 'daum', 'bing', 'yahoo', 'duckduckgo',
]);

/**
 * Per-source list of URL query params that carry the search keyword.
 * Naver uses `query`; Google / Bing / DuckDuckGo / Daum use `q`;
 * Yahoo classic uses `p`; first match wins for engines that have
 * historical variants.
 */
const KEYWORD_PARAM_BY_SOURCE: Record<TrafficSource, string[]> = {
  google:     ['q'],
  naver:      ['query', 'q'],
  daum:       ['q'],
  bing:       ['q'],
  yahoo:      ['p', 'q'],
  duckduckgo: ['q'],
  instagram:  [],
  facebook:   [],
  kakao:      [],
  twitter:    [],
  direct:     [],
  other:      [],
};

/**
 * Categorize a referrer URL into a known traffic source. Returns
 * 'direct' for null / empty / unparseable referrers (a typed URL, an
 * app-to-web jump, an HTTPS→HTTP downgrade that strips the header).
 * Unknown referrers fall to 'other' — caller can inspect the raw URL
 * if it needs the host.
 */
export function categorizeReferrer(ref: string | null | undefined): TrafficSource {
  if (!ref || ref.trim() === '') return 'direct';
  let host = '';
  try {
    host = new URL(ref).hostname.toLowerCase();
  } catch {
    return 'other';
  }
  // Order: search engines first (they're the highest-value buckets to
  // distinguish), then social, then the catch-all kakao bucket.
  if (host.includes('google.')) return 'google';
  if (host.includes('naver.')) return 'naver';
  if (host.includes('daum.net') || host.includes('search.daum.')) return 'daum';
  if (host.endsWith('bing.com') || host === 'bing.com') return 'bing';
  if (host.includes('yahoo.')) return 'yahoo';
  if (host.includes('duckduckgo.')) return 'duckduckgo';
  if (host.includes('instagram.') || host === 'l.instagram.com') return 'instagram';
  if (host.includes('facebook.') || host === 'm.facebook.com' || host === 'l.facebook.com') return 'facebook';
  if (host === 'twitter.com' || host === 't.co' || host === 'x.com' || host.endsWith('.twitter.com') || host.endsWith('.x.com')) return 'twitter';
  if (host.includes('kakao.') || host === 'pf.kakao.com') return 'kakao';
  return 'other';
}

/**
 * Extract the search keyword from a referrer URL, when it's a search
 * engine. Returns null for non-search referrers and for search engines
 * that didn't include a recognizable query param (most Google HTTPS
 * visits — they redirect through a tracking host and strip the q).
 *
 * Note on Google: post-2013 Google encrypts query strings for signed-
 * in users. Most kr.google traffic shows up here as a referrer with
 * no `q` param at all. That's expected — we record what we see; we
 * don't fake "(not provided)" because the value would conflate with
 * Google's legitimate "didn't share" signal.
 */
export function extractSearchKeyword(
  ref: string | null | undefined,
  source: TrafficSource,
): string | null {
  if (!ref) return null;
  if (!SEARCH_SOURCES.has(source)) return null;
  let url: URL;
  try {
    url = new URL(ref);
  } catch {
    return null;
  }
  for (const key of KEYWORD_PARAM_BY_SOURCE[source]) {
    const value = url.searchParams.get(key);
    if (value && value.trim().length > 0) {
      // URL().searchParams.get already decodes %-encoded chars and
      // turns + into space for query-string values.
      return value.trim().slice(0, 200);
    }
  }
  return null;
}
