'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import {
  Menu as MenuIcon, Search, Bell, Headphones, Bookmark,
  Monitor, Smartphone, ChevronDown, User, LayoutGrid, MessageSquare,
} from 'lucide-react';
import BackToHubLink from './BackToHubLink';

interface Props {
  title: string;
  previewUrl: string | null;
  onOpenDrawer: () => void;
  onOpenSearch: () => void;
}

/**
 * Cafe24-style top bar — rewritten 2026-06-21 against the reference.
 *
 * Cafe24's actual top bar is denser than what we shipped:
 *   - Left cluster: shop selector + PC/mobile viewport toggle
 *   - Right cluster (in order, all gray-tone icons):
 *     사이트캐시 삭제 link · search input ·
 *     headphones (support) · bell (with red dot) · bookmark ·
 *     user · app-grid · KOKKOK AI 챗봇 (rounded light-blue pill)
 *
 * The boss called out our previous AI button (flat dark navy) as
 * un-Cafe24. Cafe24's actual "AI 챗봇" CTA is a rounded pill with a
 * light-blue gradient outline + soft blue tint inside. Matched here.
 *
 * The page title was previously rendered inline next to the shop
 * selector; Cafe24 keeps it OUT of the top bar entirely and surfaces it
 * inside the content area instead. Followed that — pages already
 * render their own PageHeader, so the top bar is now purely chrome.
 */
export default function AdminTopBar({ title, previewUrl, onOpenDrawer, onOpenSearch }: Props) {
  return (
    <header className="h-12 bg-white border-b border-[#e5e7eb] flex items-center px-3 sm:px-4 gap-2 sticky top-0 z-30">
      <button
        type="button"
        className="md:hidden text-[#6b7280] hover:text-[#1f2937] hover:bg-[#f3f4f6] p-1 rounded transition-colors"
        onClick={onOpenDrawer}
        aria-label="메뉴 열기"
      >
        <MenuIcon className="w-4 h-4" />
      </button>

      <Suspense fallback={null}>
        <BackToHubLink />
      </Suspense>

      {/* Store selector chip — one storefront so this is read-only;
          shape matches the Cafe24 reference. */}
      <div className="hidden md:flex items-center gap-1 px-2 py-1 text-[12px] text-[#1f2937] border border-[#e5e7eb] rounded bg-white hover:bg-[#f9fafb] cursor-default">
        <span className="text-[#6b7280]">(기본)</span>
        <span>한국어 쇼핑몰</span>
        <ChevronDown className="w-3 h-3 text-[#9ca3af]" />
      </div>

      {/* Viewport toggle — purely visual; homepage builder owns the real switch. */}
      <div className="hidden lg:flex items-center gap-0.5 ml-1 border border-[#e5e7eb] rounded bg-white overflow-hidden">
        <button
          type="button"
          className="px-1.5 py-1 text-[#1f2937] bg-[#f3f4f6] cursor-default"
          aria-label="PC 미리보기"
        >
          <Monitor className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          className="px-1.5 py-1 text-[#9ca3af] hover:text-[#1f2937] cursor-default"
          aria-label="모바일 미리보기"
        >
          <Smartphone className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1" />

      {/* "사이트캐시 삭제" — Cafe24's "clear site cache" link, kept text-only
          per the reference. Triggers a hard reload that bypasses cache. */}
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="hidden lg:inline text-[11.5px] text-[#6b7280] hover:text-[#1f2937] transition-colors px-1"
        title="사이트 캐시를 비우고 새로고침"
      >
        사이트캐시 삭제
      </button>

      {/* Search — Cafe24 renders this as a small inline input, not a kbd-
          decorated button. Click-to-open behavior preserved for ⌘K. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden sm:flex items-center gap-2 px-2.5 py-1 text-[11.5px] text-[#9ca3af] bg-[#f7f8fa] border border-[#e5e7eb] hover:bg-[#f3f4f6] rounded transition-colors w-[180px]"
        aria-label="전역 검색"
      >
        <Search className="w-3.5 h-3.5" />
        <span className="flex-1 text-left truncate">KOKKOK 통합검색</span>
        <kbd className="hidden md:inline px-1 py-0 text-[9px] font-mono bg-white border border-[#e5e7eb] rounded text-[#9ca3af]">⌘K</kbd>
      </button>

      {/* Icon cluster — Cafe24's right-side toolbar. Each is a 28px square
          icon button with a gray tone, hover bg gray-100. */}
      <div className="hidden sm:flex items-center gap-0.5">
        <TopBarIconButton label="고객 지원">
          <Headphones className="w-4 h-4" />
        </TopBarIconButton>
        <TopBarIconButton label="알림">
          <Bell className="w-4 h-4" />
          <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#ef4444] rounded-full" />
        </TopBarIconButton>
        <TopBarIconButton label="북마크">
          <Bookmark className="w-4 h-4" />
        </TopBarIconButton>
        <TopBarIconButton label="내 계정">
          <User className="w-4 h-4" />
        </TopBarIconButton>
        <TopBarIconButton label="앱">
          <LayoutGrid className="w-4 h-4" />
        </TopBarIconButton>
      </div>

      {previewUrl && (
        <Link
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden lg:inline text-[11.5px] text-[#6b7280] hover:text-[#1f2937] transition-colors px-1"
        >
          스토어 보기
        </Link>
      )}

      {/* KOKKOK AI — Cafe24's "AI 챗봇" CTA is a rounded pill with a soft
          light-blue tint + a colored icon. Was a flat dark-navy block
          (PR #219) and before that a rainbow gradient (#217-) — both
          read as off. This shape matches the actual reference. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex items-center gap-1.5 ml-1 px-2.5 py-1 text-[11.5px] font-semibold text-[#1565c0] rounded-full bg-[#e3f2fd] border border-[#bbdefb] hover:bg-[#bbdefb] transition-colors"
      >
        <MessageSquare className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">KOKKOK AI 챗봇</span>
      </button>

      {/* Hidden — title is rendered in the page body now per Cafe24's
          actual layout. Kept the prop so callers don't need to change. */}
      <span className="sr-only">{title}</span>
    </header>
  );
}

function TopBarIconButton({
  children, label,
}: { children: React.ReactNode; label: string }) {
  return (
    <button
      type="button"
      className="relative w-7 h-7 flex items-center justify-center text-[#6b7280] hover:text-[#1f2937] hover:bg-[#f3f4f6] rounded transition-colors"
      aria-label={label}
      title={label}
    >
      {children}
    </button>
  );
}
