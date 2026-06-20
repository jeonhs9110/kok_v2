'use client';

import Link from 'next/link';
import {
  Monitor, Smartphone, Maximize2, RefreshCw, ExternalLink, LogOut,
  ChevronDown, Lock, HelpCircle, Settings,
} from 'lucide-react';
import type { ViewportMode } from './types';

/**
 * Top toolbar styled after Cafe24's builder chrome. Dark slate background
 * (≈ #2a2d3e) with rows of compact actions: skin label, page selector,
 * device toggle, history controls, account/help/settings, exit.
 *
 * The hub is the only place this lives — other admin pages use the
 * default sidebar layout. The operator gets the full Cafe24 vibe here
 * without fragmenting the rest of the admin's nav.
 */
interface Props {
  viewport: ViewportMode;
  onViewportChange: (v: ViewportMode) => void;
  onReload: () => void;
}

export default function TopToolbar({ viewport, onViewportChange, onReload }: Props) {
  return (
    <header className="h-12 bg-[#2a2d3e] text-white flex items-center px-3 gap-2 shadow-sm flex-shrink-0">
      {/* ── Left: skin / shop label ──────────────────────────── */}
      <button
        type="button"
        className="flex items-center gap-1.5 px-2 py-1 rounded text-sm font-semibold hover:bg-white/10 transition-colors"
        title="현재 디자인"
      >
        쇼핑몰 기본 디자인
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>
      <span className="text-xs text-white/40 hidden md:inline">|</span>
      <Link
        href="/kr"
        target="_blank"
        rel="noopener noreferrer"
        className="hidden md:inline-flex items-center gap-1 text-xs text-white/60 hover:text-white transition-colors"
        title="새 탭에서 사이트 열기"
      >
        한국어 쇼핑몰 <ExternalLink className="w-3 h-3" />
      </Link>

      <div className="w-px h-5 bg-white/10 mx-2" />

      {/* ── Page selector — only one page for now but the dropdown
            slot is here so the Phase 1.5 page picker drops in cleanly. */}
      <button
        type="button"
        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-white/5 hover:bg-white/15 transition-colors text-sm font-semibold"
      >
        메인 페이지
        <ChevronDown className="w-3.5 h-3.5 opacity-60" />
      </button>

      <div className="w-px h-5 bg-white/10 mx-2" />

      {/* ── Device toggle (PC / 모바일 / 전체) ──────────────────── */}
      <div className="inline-flex bg-white/5 rounded p-0.5">
        <ToolbarToggle
          active={viewport === 'pc'}
          onClick={() => onViewportChange('pc')}
          aria-label="PC 미리보기"
        >
          <Monitor className="w-4 h-4" />
        </ToolbarToggle>
        <ToolbarToggle
          active={viewport === 'mobile'}
          onClick={() => onViewportChange('mobile')}
          aria-label="모바일 미리보기"
        >
          <Smartphone className="w-4 h-4" />
        </ToolbarToggle>
        <ToolbarToggle
          active={viewport === 'fit'}
          onClick={() => onViewportChange('fit')}
          aria-label="전체 보기"
        >
          <Maximize2 className="w-4 h-4" />
        </ToolbarToggle>
      </div>

      <div className="w-px h-5 bg-white/10 mx-2" />

      <button
        type="button"
        onClick={onReload}
        className="inline-flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 transition-colors text-xs"
        title="미리보기 새로고침"
      >
        <RefreshCw className="w-3.5 h-3.5" />
        <span className="hidden sm:inline">새로고침</span>
      </button>

      {/* ── Right cluster: account state / help / settings / exit ── */}
      <div className="ml-auto flex items-center gap-1">
        <button
          type="button"
          className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded hover:bg-white/10 transition-colors text-xs"
          title="로그인 상태로 미리보기"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>로그인</span>
        </button>
        <button
          type="button"
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="도움말"
        >
          <HelpCircle className="w-4 h-4" />
        </button>
        <Link
          href="/admin/theme"
          className="p-1.5 rounded hover:bg-white/10 transition-colors"
          title="테마 설정"
        >
          <Settings className="w-4 h-4" />
        </Link>
        <Link
          href="/admin"
          className="inline-flex items-center gap-1.5 px-2 py-1 ml-1 rounded bg-white/5 hover:bg-white/15 transition-colors text-xs font-semibold"
          title="관리자 대시보드로 돌아가기"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">종료</span>
        </Link>
      </div>
    </header>
  );
}

function ToolbarToggle({
  active, onClick, children, ...rest
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
} & React.AriaAttributes) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded transition-colors ${
        active ? 'bg-white text-[#2a2d3e] shadow-sm' : 'text-white/70 hover:text-white'
      }`}
      {...rest}
    >
      {children}
    </button>
  );
}
