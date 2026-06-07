'use client';

/**
 * Cmd/Ctrl+K global search for the admin portal. Searches products by name,
 * menus + pages + posts by title across language fields. Each result links
 * to the admin edit screen that owns the row (not the public storefront).
 *
 * Mounted in src/app/admin/layout.tsx; the keyboard shortcut and open state
 * also live in that file. This component just owns the modal UI + the
 * debounced query lifecycle.
 *
 * Each query runs an ILIKE on the JSONB text representation so kr/en/jp/cn
 * matches all hit the same index scan path. Limit 8 per entity keeps the
 * dropdown short — the admin can tighten the query if they want more.
 */

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Search, Package, MenuSquare, FileText, Layers, Loader2 } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';

const supabase = getSupabaseBrowser();

type LangMap = Record<string, string>;

type Result =
  | { kind: 'product'; id: string; label: string; href: string }
  | { kind: 'menu';    id: string; label: string; href: string }
  | { kind: 'page';    id: string; label: string; href: string }
  | { kind: 'post';    id: string; label: string; href: string };

function pickLabel(m: LangMap | string | null | undefined, fallback: string): string {
  if (!m) return fallback;
  if (typeof m === 'string') return m;
  return m.kr || m.en || m.jp || m.cn || m.vn || m.th || fallback;
}

const KIND_META: Record<Result['kind'], { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  product: { icon: Package, label: '상품', color: 'text-blue-500' },
  menu:    { icon: MenuSquare, label: '메뉴', color: 'text-purple-500' },
  page:    { icon: Layers, label: '페이지', color: 'text-amber-500' },
  post:    { icon: FileText, label: '게시글', color: 'text-emerald-500' },
};

export default function AdminSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input as soon as the modal opens, reset state on close.
  // Resetting state in an effect is intentional — driven by the `open`
  // prop owned by the parent, no render cycle.
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      /* eslint-disable react-hooks/set-state-in-effect */
      setQuery('');
      setResults([]);
      /* eslint-enable react-hooks/set-state-in-effect */
    }
  }, [open]);

  // Close on Escape — Cmd+K toggle lives in the parent so we don't intercept
  // it here too and double-fire.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Debounced search. 200ms is the sweet spot — fast enough to feel live,
  // slow enough that typing "skincare" doesn't fire 8 queries. setState in
  // effect is the right pattern here — query state drives a side-effect
  // (the network fetch) and the loading/results state reflects its outcome.
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
      // Strip PostgREST .or() tree-parser special chars from the user's
      // query before interpolating. Letters (Latin + Hangul + other scripts),
      // digits, and whitespace survive; commas / periods / parens / ::
      // would otherwise terminate the OR expression early or be parsed as
      // operator boundaries.
      const safeQ = trimmed.replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
      if (!safeQ) { setResults([]); setLoading(false); return; }
      // JSONB title/name columns store { kr, en, jp, cn, vn, th }. We OR
      // ilike across each language path via the documented PostgREST
      // arrow-extract syntax (->>lang). The earlier `.filter('col::text',
      // 'ilike', …)` shape isn't a documented PostgREST cast and silently
      // returned nothing in supabase-js.
      const LANGS = ['kr', 'en', 'jp', 'cn', 'vn', 'th'];
      const orJsonb = (col: string) =>
        LANGS.map(l => `${col}->>${l}.ilike.%${safeQ}%`).join(',');
      const [products, menus, pages, posts] = await Promise.all([
        supabase.from('products').select('id,name').or(orJsonb('name')).limit(8),
        supabase.from('menus').select('id,slug,title').or(orJsonb('title')).limit(8),
        supabase.from('pages').select('id,slug,title').or(orJsonb('title')).limit(8),
        // posts.title is plain text (single-language), so a flat ilike
        // hits it directly — see src/lib/api/menus.ts Post interface.
        supabase.from('posts').select('id,title,menu_id').ilike('title', `%${safeQ}%`).limit(8),
      ]);
      const rs: Result[] = [];
      for (const p of (products.data ?? [])) {
        rs.push({ kind: 'product', id: p.id, label: pickLabel((p as { name: LangMap }).name, '(이름 없음)'), href: `/admin/products` });
      }
      for (const m of (menus.data ?? [])) {
        const mm = m as { id: string; slug: string; title: LangMap };
        rs.push({ kind: 'menu', id: mm.id, label: `${pickLabel(mm.title, mm.slug)} · /${mm.slug}`, href: `/admin/menus/${mm.id}` });
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-gray-100 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
          <Search className="w-5 h-5 text-gray-400" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="상품, 메뉴, 페이지, 게시글 검색…"
            className="flex-1 outline-none text-sm bg-transparent"
          />
          {loading && <Loader2 className="w-4 h-4 text-gray-400 animate-spin" />}
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded">esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              2자 이상 입력해 검색하세요.
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">
              일치하는 결과가 없습니다.
            </div>
          ) : (
            <ul className="py-1">
              {results.map((r) => {
                const meta = KIND_META[r.kind];
                const Icon = meta.icon;
                return (
                  <li key={`${r.kind}:${r.id}`}>
                    <Link
                      href={r.href}
                      onClick={onClose}
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-gray-50 transition-colors"
                    >
                      <Icon className={`w-4 h-4 ${meta.color} flex-shrink-0`} />
                      <span className="text-sm text-gray-900 truncate flex-1">{r.label}</span>
                      <span className="text-[10px] uppercase tracking-wider text-gray-400 flex-shrink-0">{meta.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
