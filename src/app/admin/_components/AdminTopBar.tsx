'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import {
  Menu as MenuIcon, Search, Eye, Bell, HelpCircle, Sparkles,
  Monitor, Smartphone, ChevronDown,
} from 'lucide-react';
import BackToHubLink from './BackToHubLink';

interface Props {
  title: string;
  previewUrl: string | null;
  onOpenDrawer: () => void;
  onOpenSearch: () => void;
}

/**
 * Cafe24-style top bar — page title + store selector chip + PC/mobile
 * viewport toggle + global search + notification cluster + KOKKOK AI
 * pill. The viewport toggle is purely visual today; the real preview
 * switch lives on /admin/homepage.
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
      <h1 className="text-[13px] font-semibold text-[#1f2937] truncate">{title}</h1>

      {/* Store selector chip — one storefront so this is read-only;
          shape matches the Cafe24 reference. */}
      <div className="hidden md:flex items-center gap-1 ml-2 px-2 py-0.5 text-[11.5px] text-[#1f2937] border border-[#e5e7eb] rounded bg-white hover:bg-[#f9fafb] cursor-default">
        <span className="text-[#6b7280]">(기본)</span>
        <span>한국어 쇼핑몰</span>
        <ChevronDown className="w-3 h-3 text-[#9ca3af]" />
      </div>

      {/* Viewport toggle — purely visual; homepage builder owns the real switch. */}
      <div className="hidden lg:flex items-center gap-0.5 ml-1 p-0.5 border border-[#e5e7eb] rounded bg-[#fafbfc]">
        <button
          type="button"
          className="p-0.5 rounded bg-white text-[#1f2937] shadow-sm cursor-default"
          aria-label="PC 미리보기"
        >
          <Monitor className="w-3 h-3" />
        </button>
        <button
          type="button"
          className="p-0.5 rounded text-[#9ca3af] hover:text-[#1f2937] cursor-default"
          aria-label="모바일 미리보기"
        >
          <Smartphone className="w-3 h-3" />
        </button>
      </div>

      <div className="flex-1" />

      <button
        type="button"
        onClick={onOpenSearch}
        className="hidden sm:flex items-center gap-1.5 px-2 py-1 text-[11.5px] text-[#6b7280] bg-[#f3f4f6] hover:bg-[#e5e7eb] rounded transition-colors"
        aria-label="전역 검색"
      >
        <Search className="w-3 h-3" />
        <span className="hidden md:inline">통합 검색</span>
        <kbd className="hidden md:inline ml-0.5 px-1 py-0 text-[9px] font-mono bg-white border border-[#e5e7eb] rounded">⌘K</kbd>
      </button>

      <button
        type="button"
        className="hidden sm:flex relative w-7 h-7 items-center justify-center text-[#6b7280] hover:text-[#1f2937] hover:bg-[#f3f4f6] rounded transition-colors"
        aria-label="도움말"
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        className="hidden sm:flex relative w-7 h-7 items-center justify-center text-[#6b7280] hover:text-[#1f2937] hover:bg-[#f3f4f6] rounded transition-colors"
        aria-label="알림"
      >
        <Bell className="w-3.5 h-3.5" />
        <span className="absolute top-1 right-1 w-1.5 h-1.5 bg-[#ef4444] rounded-full" />
      </button>

      {previewUrl && (
        <Link
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1 px-2 py-1 text-[11.5px] text-[#1f2937] border border-[#e5e7eb] hover:bg-[#f9fafb] rounded transition-colors"
        >
          <Eye className="w-3 h-3" />
          <span className="hidden md:inline">스토어 보기</span>
        </Link>
      )}

      {/* KOKKOK AI — flat dark navy to match Cafe24's "Cafe24 Plus" badge
          shape. Was a rainbow gradient pill, which read as Western SaaS;
          Cafe24's own brand-action badges are flat solid blocks. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="flex items-center gap-1 px-2 sm:px-2.5 py-1 text-[11.5px] font-semibold text-white rounded bg-[#1b2330] hover:bg-[#2a3441] transition-colors"
      >
        <Sparkles className="w-3 h-3" />
        <span className="hidden sm:inline">KOKKOK AI</span>
      </button>
    </header>
  );
}
