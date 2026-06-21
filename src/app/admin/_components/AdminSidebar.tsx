'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, LogOut, ExternalLink, X } from 'lucide-react';
import { NAV_SECTIONS } from './nav';

interface Props {
  pathname: string;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

const COLLAPSE_KEY = 'kokkok-admin-sidebar-collapsed';

/**
 * Cafe24-mimicking sidebar.
 *
 * Cafe24's admin sidebar has a very specific gestalt that previous
 * iterations missed:
 *   - Collapsible section groups with chevron arrows (state persisted
 *     in localStorage across sessions).
 *   - 3px blue left-border on the active item (not a tinted bg fill).
 *   - Section titles are normal-weight Korean, NOT all-caps tracking —
 *     all-caps reads "Western SaaS dashboard," not Cafe24.
 *   - 36px row height + 13px text + monochrome 16px icons. Anything
 *     denser feels cramped, anything looser feels modern-SaaS.
 *   - Simple wordmark in the brand area, no chip/gradient — Cafe24
 *     never decorates its own brand area.
 *   - Auto-expand whichever section contains the active page so
 *     deep-linked admins can see where they are without manually
 *     opening their group.
 */
export default function AdminSidebar({ pathname, drawerOpen, onCloseDrawer }: Props) {
  // Which section is the active page in? That one is always open on
  // mount even if the user previously collapsed it — orientation beats
  // strict persistence.
  const activeSectionIdx = useMemo(() => {
    return NAV_SECTIONS.findIndex(s =>
      s.items.some(i =>
        pathname === i.href || (i.href !== '/admin' && pathname.startsWith(i.href + '/')),
      ),
    );
  }, [pathname]);

  const [collapsed, setCollapsed] = useState<Set<number>>(() => new Set());

  // Restore collapse state from localStorage on mount. Run once; later
  // navigations don't reset because the active section gets force-opened
  // in the render path below. The set-state-in-effect lint rule fires
  // for any post-mount hydration of client-only storage — accepted
  // codebase pattern (see /admin/layout.tsx drawerOpen reset).
  useEffect(() => {
    try {
      const raw = localStorage.getItem(COLLAPSE_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setCollapsed(new Set(JSON.parse(raw)));
    } catch { /* ignore corrupt JSON */ }
  }, []);

  const persist = (next: Set<number>) => {
    setCollapsed(next);
    try { localStorage.setItem(COLLAPSE_KEY, JSON.stringify([...next])); } catch { /* quota */ }
  };

  const toggle = (idx: number) => {
    const next = new Set(collapsed);
    if (next.has(idx)) next.delete(idx); else next.add(idx);
    persist(next);
  };

  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-[210px] bg-[#1b2330] text-gray-300 flex flex-col transform transition-transform duration-200 ease-out md:transform-none ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Brand header — 48px (Cafe24's ruler), flat, no chip / no gradient. */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-black/40">
        <div className="flex items-center gap-2">
          <span className="w-1 h-4 bg-[#3b82f6] rounded-sm" />
          <span className="text-[12.5px] font-bold tracking-wide text-white">KOKKOK 관리자</span>
        </div>
        <button
          type="button"
          className="md:hidden text-gray-400 hover:text-white"
          onClick={onCloseDrawer}
          aria-label="메뉴 닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <nav className="flex-1 py-1.5 overflow-y-auto">
        {NAV_SECTIONS.map((section, idx) => {
          // Section is "open" if (a) it contains the active item, or
          // (b) the user hasn't manually collapsed it. Sections with no
          // title (the top group containing 대시보드 + 메뉴 관리) are
          // always rendered as a flat list, never collapsed.
          const isActiveSection = idx === activeSectionIdx;
          const isOpen = !section.title || isActiveSection || !collapsed.has(idx);

          return (
            <div key={idx}>
              {section.title && (
                <button
                  type="button"
                  onClick={() => toggle(idx)}
                  className="w-full flex items-center justify-between px-4 pt-3 pb-1 text-[10.5px] font-bold text-white/70 hover:text-white transition-colors"
                >
                  <span>{section.title}</span>
                  <ChevronDown
                    className={`w-2.5 h-2.5 text-gray-500 transition-transform ${isOpen ? '' : '-rotate-90'}`}
                  />
                </button>
              )}
              {isOpen && section.items.map(item => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
                const Icon = item.icon;
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={`relative flex items-center gap-2.5 pl-4 pr-3 h-8 text-[12px] transition-colors ${
                      isActive
                        ? 'bg-[#222d3d] text-white font-semibold'
                        : 'text-gray-400 hover:text-white hover:bg-white/[0.03]'
                    }`}
                  >
                    {/* Slim left indicator — Cafe24's active-state signature. */}
                    {isActive && (
                      <span
                        aria-hidden="true"
                        className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#3b82f6]"
                      />
                    )}
                    <Icon className="w-3.5 h-3.5 flex-shrink-0 stroke-[1.75]" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="border-t border-black/40 py-1.5">
        <Link
          href="/kr"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2.5 pl-4 pr-3 h-8 text-[11.5px] text-gray-400 hover:text-white hover:bg-white/[0.03] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
          스토어 보기
        </Link>
        <button
          onClick={() => {
            document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.location.href = '/';
          }}
          className="w-full flex items-center gap-2.5 pl-4 pr-3 h-8 text-[11.5px] text-gray-400 hover:text-white hover:bg-white/[0.03] transition-colors border-none bg-transparent text-left"
        >
          <LogOut className="w-3.5 h-3.5 stroke-[1.75]" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
