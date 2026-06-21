'use client';

import Link from 'next/link';
import { ChevronsLeft, LogOut, ExternalLink, X } from 'lucide-react';
import { NAV_ITEMS } from './nav';

interface Props {
  pathname: string;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

/**
 * Cafe24-style admin sidebar — rewritten 2026-06-21 against the actual
 * reference screenshot the boss is anchoring to.
 *
 * What the previous iterations got wrong:
 *   - Active state was a 3px blue LEFT-BORDER on a darker tinted row.
 *     Cafe24's actual active state is a FULL BLUE ROW BG (#1565c0-ish)
 *     with white bold text. The slim border was the single biggest
 *     "this isn't Cafe24" tell — fixed now.
 *   - Section headers / collapsible groups were added. Cafe24's sidebar
 *     is a FLAT LIST with no group titles, no chevrons, no toggle. Every
 *     item is a single 36px row.
 *   - Brand area had a gradient KK chip, then a blue accent rule + bold
 *     wordmark. Cafe24's actual brand area is "cafe24" wordmark in white
 *     + a `«` collapse icon on the right, nothing else.
 *   - Background was #1b2330. Cafe24's is closer to #1c1c2e (cooler /
 *     blacker, less blue).
 *
 * Width 180px matches Cafe24's actual ruler — narrower than the 224 /
 * 210 we shipped previously. Items are listed in Cafe24's information
 * order (홈 first, then commerce, then design, then services).
 */
export default function AdminSidebar({ pathname, drawerOpen, onCloseDrawer }: Props) {
  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-[180px] bg-[#1c1c2e] text-white flex flex-col transform transition-transform duration-200 ease-out md:transform-none ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      {/* Brand header — flat wordmark + collapse icon, no chip/gradient.
          48px tall (Cafe24's ruler). */}
      <div className="h-12 flex items-center justify-between px-4 border-b border-white/[0.06]">
        <span className="text-[15px] font-extrabold tracking-tight text-white lowercase">kokkok</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="hidden md:flex text-white/50 hover:text-white p-1 rounded transition-colors"
            aria-label="사이드바 접기"
            title="사이드바 접기"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="md:hidden text-white/50 hover:text-white p-1 rounded transition-colors"
            onClick={onCloseDrawer}
            aria-label="메뉴 닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Flat nav — no section headers, no chevrons. Every item is a
          single row. Cafe24's actual sidebar has chevrons because items
          expand to sub-pages; our admin is flat (one page per item) so
          chevrons would lie about the structure. */}
      <nav className="flex-1 overflow-y-auto py-2">
        {NAV_ITEMS.map(item => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2.5 h-9 px-4 text-[13px] transition-colors ${
                isActive
                  ? 'bg-[#1565c0] text-white font-semibold'
                  : 'text-white/[0.82] hover:bg-white/[0.05]'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0 stroke-[1.75]" />
              <span className="truncate flex-1">{item.name}</span>
              {item.isNew && (
                <span className="text-[9px] font-bold text-white bg-[#ef4444] px-1 py-0 rounded leading-tight">
                  NEW
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.06] py-2">
        <Link
          href="/kr"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2.5 h-9 px-4 text-[12px] text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 stroke-[1.75]" />
          스토어 보기
        </Link>
        <button
          onClick={() => {
            document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.location.href = '/';
          }}
          className="w-full flex items-center gap-2.5 h-9 px-4 text-[12px] text-white/60 hover:text-white hover:bg-white/[0.05] transition-colors border-none bg-transparent text-left"
        >
          <LogOut className="w-3.5 h-3.5 stroke-[1.75]" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
