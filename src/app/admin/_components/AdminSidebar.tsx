'use client';

import Link from 'next/link';
import { LogOut, ExternalLink, X } from 'lucide-react';
import { NAV_ITEMS } from './nav';
import { USE_COGNITO_FROM_BROWSER } from '@/lib/auth/clientFlags';

interface Props {
  pathname: string;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

/**
 * Cafe24-style hover-expand sidebar.
 *
 * Default desktop state: 56px wide, icons only. Hover anywhere over the
 * rail expands it to 224px and the text labels fade in. Mouse leave
 * collapses back to icons. This is the signature Cafe24 interaction
 * earlier iterations missed — they shipped a permanently-expanded rail.
 *
 * Sidebar is FIXED-positioned on desktop so the content area gets a
 * static 56px gutter (md:ml-14 on <main>) — when the sidebar expands on
 * hover it overlays content instead of shifting it. Without this the
 * whole page would jump every time the cursor brushes the rail.
 *
 * Mobile: keeps the existing drawer behavior (full-width slide-in from
 * left, backdrop on the rest of the screen). drawerOpen prop drives it.
 *
 * Color hierarchy:
 *   bg          #181a26   (the rail body)
 *   accent bar  #13151e   (brand strip top + footer strip — darker)
 *   active row  #1976d2   (full blue bg + white bold text)
 *   inactive    rgba(255,255,255,0.85)  (white-ish at hover-on)
 *   hover bg    rgba(255,255,255,0.04)  (very faint)
 *
 * Font: forces Pretendard via the layout's preloaded CSS so the
 * Cafe24-matching geometry lands. Without this the sidebar inherited
 * Freesentation which has different letter widths and reads as off.
 */
export default function AdminSidebar({ pathname, drawerOpen, onCloseDrawer }: Props) {
  return (
    <aside
      style={{ fontFamily: 'Pretendard, "Noto Sans KR", system-ui, sans-serif' }}
      className={`
        group/sb
        fixed inset-y-0 left-0 z-40
        flex flex-col
        bg-[#181a26] text-white
        overflow-hidden
        transition-[width,transform] duration-200 ease-out
        w-[224px] md:w-14 md:hover:w-[224px]
        ${drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `.replace(/\s+/g, ' ').trim()}
    >
      {/* Brand strip — Cafe24's two-tone hierarchy: this strip is the
          DARKER shade flanking the lighter menu body. 48px tall. */}
      <div className="h-12 flex items-center justify-between bg-[#13151e] border-b border-black/30 whitespace-nowrap flex-shrink-0">
        <div className="flex items-center pl-[18px] gap-2 min-w-0">
          <span className="w-1 h-4 bg-[#1976d2] rounded-sm flex-shrink-0" />
          <span className="text-[13px] font-bold tracking-tight text-white lowercase opacity-100 md:opacity-0 md:group-hover/sb:opacity-100 transition-opacity duration-150 md:delay-75">
            kokkok 관리자
          </span>
        </div>
        <button
          type="button"
          className="md:hidden text-white/50 hover:text-white p-1 pr-3 rounded transition-colors flex-shrink-0"
          onClick={onCloseDrawer}
          aria-label="메뉴 닫기"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Nav body — flat list. Active row gets full blue bg. */}
      <nav className="flex-1 overflow-y-auto py-1.5">
        {NAV_ITEMS.map(item => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/admin' && pathname.startsWith(item.href + '/'));
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.name}
              className={`
                flex items-center h-9 pl-[18px] pr-3 gap-3 text-[13px]
                whitespace-nowrap transition-colors
                ${isActive
                  ? 'bg-[#1976d2] text-white font-semibold'
                  : 'text-white/[0.85] hover:bg-white/[0.04]'}
              `.replace(/\s+/g, ' ').trim()}
            >
              <Icon className="w-4 h-4 flex-shrink-0 stroke-[1.75]" />
              <span className="opacity-100 md:opacity-0 md:group-hover/sb:opacity-100 transition-opacity duration-150 md:delay-75">
                {item.name}
              </span>
              {item.isNew && (
                <span className="ml-auto text-[9px] font-bold text-white bg-[#ef4444] px-1 py-0 rounded leading-tight opacity-100 md:opacity-0 md:group-hover/sb:opacity-100 transition-opacity duration-150 md:delay-75">
                  NEW
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Footer strip — same darker bg as the brand strip, two-tone caps. */}
      <div className="bg-[#13151e] py-1.5 whitespace-nowrap flex-shrink-0">
        <Link
          href="/kr"
          target="_blank"
          rel="noopener noreferrer"
          title="스토어 보기"
          className="flex items-center h-9 pl-[18px] pr-3 gap-3 text-[12px] text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors"
        >
          <ExternalLink className="w-3.5 h-3.5 flex-shrink-0 stroke-[1.75]" />
          <span className="opacity-100 md:opacity-0 md:group-hover/sb:opacity-100 transition-opacity duration-150 md:delay-75">
            스토어 보기
          </span>
        </Link>
        <button
          onClick={async () => {
            // Pre-Cognito this button only cleared the (non-httpOnly)
            // kokkok_admin_auth mirror cookie and redirected. After the
            // Cognito cutover that's a real security regression: the
            // cognito_id_token / cognito_access_token / cognito_refresh_token
            // are httpOnly so document.cookie can't touch them, and
            // proxy.ts gates /admin on the id_token. Result: operator
            // hits "Logout", lands on `/`, but anyone using the same
            // browser window can navigate straight back to /admin
            // and the JWT in the cookie still passes the admins-group
            // check. /api/auth/cognito/sign-out runs the upstream
            // GlobalSignOut AND clears every cookie server-side
            // (including kokkok_auth + kokkok_admin_auth), so the
            // logout is actually a logout. Mirror the same dispatcher
            // pattern Header.tsx uses for the storefront button.
            if (USE_COGNITO_FROM_BROWSER) {
              try {
                await fetch('/api/auth/cognito/sign-out', { method: 'POST' });
              } catch { /* fall through to client-side cleanup */ }
            }
            // Belt-and-suspenders for the non-Cognito fallback path
            // AND for the rare case where the fetch above failed before
            // the server could send back the cookie-clear directives.
            document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            document.cookie = "kokkok_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
            window.location.href = '/';
          }}
          title="로그아웃"
          className="w-full flex items-center h-9 pl-[18px] pr-3 gap-3 text-[12px] text-white/60 hover:text-white hover:bg-white/[0.04] transition-colors border-none bg-transparent text-left"
        >
          <LogOut className="w-3.5 h-3.5 flex-shrink-0 stroke-[1.75]" />
          <span className="opacity-100 md:opacity-0 md:group-hover/sb:opacity-100 transition-opacity duration-150 md:delay-75">
            로그아웃
          </span>
        </button>
      </div>
    </aside>
  );
}
