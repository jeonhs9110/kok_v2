import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

const supabase = getSupabaseBrowser();

type LangMap = Record<string, string>;

export type SearchResult =
  | { kind: 'product'; id: string; label: string; href: string }
  | { kind: 'menu';    id: string; label: string; href: string }
  | { kind: 'page';    id: string; label: string; href: string }
  | { kind: 'post';    id: string; label: string; href: string };

function pickLabel(m: LangMap | string | null | undefined, fallback: string): string {
  if (!m) return fallback;
  if (typeof m === 'string') return m;
  return m.kr || m.en || m.jp || m.cn || m.vn || m.th || fallback;
}

/**
 * Cmd/Ctrl+K global-search hook. 200ms debounced ILIKE across products
 * (plain text) + menus / pages (JSONB titles) + posts (plain text). 8
 * results per entity keeps the dropdown short.
 *
 * `safeQ` strips PostgREST .or() tree-parser special chars so commas /
 * periods / parens / :: in the user's query don't terminate the OR
 * expression early.
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

  // Debounced search. Driven by query state (a side-effect on input).
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
    const handle = setTimeout(async () => {
      if (!supabase) { setLoading(false); return; }
      const safeQ = trimmed.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
      if (!safeQ) { setResults([]); setLoading(false); return; }
      // menus.title + pages.title are JSONB { kr, en, ... } — OR ilike
      // across each language path via PostgREST's arrow-extract syntax
      // (->>lang). products.name + posts.title are plain text.
      const LANGS = ['kr', 'en', 'jp', 'cn', 'vn', 'th'];
      const orJsonb = (col: string) =>
        LANGS.map(l => `${col}->>${l}.ilike.%${safeQ}%`).join(',');
      const [products, menus, pages, posts] = await Promise.all([
        supabase.from('products').select('id,name').ilike('name', `%${safeQ}%`).limit(8),
        supabase.from('menus').select('id,slug,title').or(orJsonb('title')).limit(8),
        supabase.from('pages').select('id,slug,title').or(orJsonb('title')).limit(8),
        supabase.from('posts').select('id,title,menu_id').ilike('title', `%${safeQ}%`).limit(8),
      ]);
      const rs: SearchResult[] = [];
      for (const p of (products.data ?? [])) {
        rs.push({ kind: 'product', id: p.id, label: pickLabel((p as { name: string }).name, '(이름 없음)'), href: `/admin/products` });
      }
      for (const m of (menus.data ?? [])) {
        const mm = m as { id: string; slug: string; title: LangMap };
        // /admin/menus/[menuId] has no page.tsx; direct edit happens
        // inline on the list page — land there instead of 404'ing.
        rs.push({ kind: 'menu', id: mm.id, label: `${pickLabel(mm.title, mm.slug)} · /${mm.slug}`, href: `/admin/menus` });
      }
      for (const p of (pages.data ?? [])) {
        const pp = p as { id: string; slug: string; title: LangMap };
        rs.push({ kind: 'page', id: pp.id, label: `${pickLabel(pp.title, pp.slug)} · /${pp.slug}`, href: `/admin/pages` });
      }
      for (const p of (posts.data ?? [])) {
        const pp = p as { id: string; title: LangMap; menu_id: string };
        rs.push({ kind: 'post', id: pp.id, label: pickLabel(pp.title, '(제목 없음)'), href: `/admin/posts` });
      }
      setResults(rs);
      setLoading(false);
    }, 200);
    return () => clearTimeout(handle);
  }, [open, query]);
  /* eslint-enable react-hooks/set-state-in-effect */

  return { query, setQuery, results, loading };
}
