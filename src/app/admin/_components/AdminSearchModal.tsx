'use client';

/**
 * Cmd/Ctrl+K global search modal. Searches products by name, menus +
 * pages + posts by title across language fields. Each result links to
 * the admin edit screen.
 *
 * Mounted in src/app/admin/layout.tsx; the keyboard shortcut + open
 * state live in that file. This component owns the modal UI; data + the
 * debounced query lifecycle live in the useAdminSearch hook.
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Search, Package, MenuSquare, FileText, Layers, Loader2 } from 'lucide-react';
import { useAdminSearch, type SearchResult } from './useAdminSearch';

const KIND_META: Record<SearchResult['kind'], { icon: React.ComponentType<{ className?: string }>; label: string; color: string }> = {
  product: { icon: Package, label: '상품', color: 'text-[#3b82f6]' },
  menu:    { icon: MenuSquare, label: '메뉴', color: 'text-[#a855f7]' },
  page:    { icon: Layers, label: '페이지', color: 'text-[#f59e0b]' },
  post:    { icon: FileText, label: '게시글', color: 'text-[#10b981]' },
};

export default function AdminSearchModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { query, setQuery, results, loading } = useAdminSearch(open);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus the input on open.
  useEffect(() => {
    if (open) {
      // Defer to next tick so the input has mounted; 0ms is enough — a
      // 50ms delay would drop the first keystroke if the user types fast.
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [open]);

  // Close on Escape — Cmd+K toggle lives in the parent.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[10vh] px-4 bg-black/40"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl bg-white rounded-xl shadow-2xl border border-[#f3f4f6] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[#f3f4f6]">
          <Search className="w-5 h-5 text-[#9ca3af]" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="상품, 메뉴, 페이지, 게시글 검색…"
            className="flex-1 outline-none text-sm bg-transparent"
          />
          {loading && <Loader2 className="w-4 h-4 text-[#9ca3af] animate-spin" />}
          <kbd className="text-[10px] font-mono px-1.5 py-0.5 bg-[#f3f4f6] text-[#6b7280] rounded">esc</kbd>
        </div>

        <div className="max-h-[60vh] overflow-y-auto">
          {query.trim().length < 2 ? (
            <div className="px-4 py-8 text-center text-sm text-[#9ca3af]">
              2자 이상 입력해 검색하세요.
            </div>
          ) : results.length === 0 && !loading ? (
            <div className="px-4 py-8 text-center text-sm text-[#9ca3af]">
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
                      className="flex items-center gap-3 px-4 py-2.5 hover:bg-[#fafbfc] transition-colors"
                    >
                      <Icon className={`w-4 h-4 ${meta.color} flex-shrink-0`} />
                      <span className="text-sm text-[#1f2937] truncate flex-1">{r.label}</span>
                      <span className="text-[10px] uppercase tracking-wider text-[#9ca3af] flex-shrink-0">{meta.label}</span>
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
