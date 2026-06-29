import { useEffect, useState } from 'react';

export type SearchResult =
  | { kind: 'product'; id: string; label: string; href: string }
  | { kind: 'menu';    id: string; label: string; href: string }
  | { kind: 'page';    id: string; label: string; href: string }
  | { kind: 'post';    id: string; label: string; href: string };

/**
 * Cmd/Ctrl+K global-search hook. Debounced 200ms; delegates the actual
 * cross-table search to /api/admin/search. The route does the
 * ILIKE-across-JSONB-titles work server-side via the standard USE_RDS
 * dispatcher, so the storefront client bundle no longer drags in the
 * Supabase JS just to surface admin search results.
 *
 * 2026-06-29: previously this hook talked directly to Supabase from the
 * browser with `supabase.from(...).ilike(...)`. After the 2026-06-27
 * decommission every Cmd+K opened a search that returned zero results
 * (operator's "quick jump" feature silently broken). Now goes through
 * the new /api/admin/search route.
 */
export function useAdminSearch(open: boolean) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  // Reset state when modal closes.
  useEffect(() => {
    if (!open) {
      /* eslint-disable react-hooks/set-state-in-effect */
      setQuery('');
      setResults([]);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  // Debounced search.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let cancelled = false;
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/search?q=${encodeURIComponent(trimmed)}`, { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) {
            setResults([]);
            setLoading(false);
          }
          return;
        }
        const json = (await res.json()) as { results?: SearchResult[] };
        if (!cancelled) {
          setResults(json.results ?? []);
          setLoading(false);
        }
      } catch {
        if (!cancelled) {
          setResults([]);
          setLoading(false);
        }
      }
    }, 200);
    return () => { cancelled = true; clearTimeout(handle); };
  }, [open, query]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { query, setQuery, results, loading };
}
