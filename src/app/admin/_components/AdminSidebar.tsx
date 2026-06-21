'use client';

import Link from 'next/link';
import { LogOut, ExternalLink, X } from 'lucide-react';
import { NAV_SECTIONS } from './nav';

interface Props {
  pathname: string;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

/**
 * The Cafe24-style dark slate sidebar. Renders the grouped NAV_SECTIONS,
 * the brand chip, and the "스토어 보기" + "로그아웃" footer. Mobile
 * drawer behavior is the parent's concern (it owns drawerOpen).
 */
export default function AdminSidebar({ pathname, drawerOpen, onCloseDrawer }: Props) {
  return (
    <aside
      className={`fixed md:static inset-y-0 left-0 z-40 w-[232px] bg-[#1b2330] text-gray-300 flex flex-col transform transition-transform duration-200 ease-out md:transform-none ${
        drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}
    >
      <div className="h-14 flex items-center justify-between px-5 border-b border-[#0e1521]">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-gradient-to-br from-[#3b82f6] to-[#1e40af] flex items-center justify-center text-white text-[11px] font-extrabold tracking-tighter">
            KK
          </div>
          <span className="text-[13px] font-bold tracking-wide text-white">KOKKOK 관리자</span>
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

      <nav className="flex-1 py-3 px-2 overflow-y-auto">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx} className="mb-3 last:mb-0">
            {section.title && (
              <p className="px-3 pt-3 pb-1.5 text-[10px] font-semibold tracking-[0.14em] uppercase text-gray-500">
                {section.title}
              </p>
            )}
            {section.items.map((item) => {
              const isActive = pathname === item.href ||
                               (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
              const Icon = item.icon;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  className={`group flex items-center gap-2.5 pl-3 pr-2 py-2 rounded transition-colors text-[12px] ${
                    isActive
                      ? 'bg-[#2b6cb0]/30 text-white font-semibold'
                      : 'text-gray-400 hover:text-white hover:bg-[#2a3140]'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="truncate">{item.name}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      <div className="p-3 border-t border-[#0e1521] space-y-0.5">
        <Link
          href="/kr"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-400 hover:text-white hover:bg-[#2a3140] rounded transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5" />
          스토어 보기
        </Link>
        <button
          onClick={() => {
            document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.location.href = '/';
          }}
          className="w-full flex items-center gap-2.5 px-3 py-2 text-[12px] text-gray-400 hover:text-white hover:bg-[#2a3140] rounded transition-colors border-none bg-transparent"
        >
          <LogOut className="w-3.5 h-3.5" />
          로그아웃
        </button>
      </div>
    </aside>
  );
}
