'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  Users, Package, Video, LayoutDashboard, LogOut, ExternalLink, Tag, MenuSquare,
  Image, GalleryHorizontal, PanelTop, Heart, MessageCircle, UserPlus, CreditCard,
  Scale, Globe, ImagePlus, Star, FileText, FolderOpen, Palette, Layers, Search,
  Menu as MenuIcon, X, Eye, Home as HomeIcon, Bell, HelpCircle, Sparkles,
  Monitor, Smartphone, ChevronDown,
} from 'lucide-react';
import AdminSearchModal from './_components/AdminSearchModal';
import BackToHubLink from './_components/BackToHubLink';
import EmbeddedShell from './_components/EmbeddedShell';
import { ToastProvider } from '@/components/admin/Toast';

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { title: string | null; items: NavItem[] };

// Reorganized 2026-06-19 to match Cafe24's admin layout closer to the
// boss's reference. Key moves:
//   1. 메뉴 관리 pinned to the top (per boss directive — most-touched
//      global config, was buried under "발행 & 페이지" before).
//   2. 성분 태그 dropped from the sidebar — the admin page was deleted
//      to reduce surface area; existing tags persist in the DB and the
//      storefront keeps rendering them until a follow-up cleanup pass.
//   3. Groups renamed to Cafe24 vocabulary: 상품 · 고객 · 게시판 ·
//      디자인 · 콘텐츠 · 설정.
const NAV_SECTIONS: NavSection[] = [
  {
    title: null,
    items: [
      { name: '대시보드', href: '/admin', icon: LayoutDashboard },
      { name: '메뉴 관리', href: '/admin/menus', icon: MenuSquare },
    ],
  },
  {
    title: '상품',
    items: [
      { name: '상품 관리', href: '/admin/products', icon: Package },
      { name: '카테고리', href: '/admin/categories', icon: Tag },
    ],
  },
  {
    title: '고객',
    items: [
      { name: '사용자', href: '/admin/users', icon: Users },
      { name: '회원가입 정책', href: '/admin/registration', icon: UserPlus },
    ],
  },
  {
    title: '게시판',
    items: [
      { name: '게시글 관리', href: '/admin/posts', icon: FileText },
      { name: '쇼핑 월드와이드', href: '/admin/worldwide', icon: Globe },
    ],
  },
  {
    title: '디자인 (PC/모바일)',
    items: [
      // 홈페이지 빌더 is the PRIMARY entry — the Cafe24-style hub that
      // pulls every section into one page with a live preview. Direct
      // links below stay for muscle-memory routes admin opens often.
      { name: '홈페이지 빌더', href: '/admin/homepage', icon: HomeIcon },
      { name: '테마 (색상 / 모양)', href: '/admin/theme', icon: Palette },
      { name: '에셋 라이브러리', href: '/admin/assets', icon: FolderOpen },
      { name: '페이지 빌더', href: '/admin/pages', icon: Layers },
      { name: '로고 및 배경', href: '/admin/logo', icon: ImagePlus },
      { name: '메인 배너 (캐러셀)', href: '/admin/carousel', icon: Image },
      { name: '서브 히어로 (와이드)', href: '/admin/sub-hero', icon: PanelTop },
      { name: '프로모 배너', href: '/admin/promo-banners', icon: GalleryHorizontal },
      { name: '상단 띠배너', href: '/admin/top-stripe', icon: PanelTop },
    ],
  },
  {
    title: '콘텐츠',
    items: [
      { name: '숏츠', href: '/admin/shorts', icon: Video },
      { name: '인스타그램', href: '/admin/instagram', icon: Heart },
      { name: '리뷰 쇼케이스', href: '/admin/reviews', icon: Star },
    ],
  },
  {
    title: '설정',
    items: [
      { name: '챗봇', href: '/admin/chatbot', icon: MessageCircle },
      { name: '결제 시스템', href: '/admin/payments', icon: CreditCard },
      { name: '법적 사항 / 비즈니스 정보', href: '/admin/legal', icon: Scale },
    ],
  },
];

const PAGE_TITLE: Record<string, string> = {
  '/admin': '대시보드 개요',
  '/admin/homepage': '홈페이지 빌더',
  '/admin/top-stripe': '상단 띠배너',
  '/admin/users': '사용자 관리',
  '/admin/categories': '카테고리 관리',
  '/admin/products': '상품 관리',
  '/admin/logo': '로고 및 배경 관리',
  '/admin/assets': '에셋 라이브러리',
  '/admin/pages': '페이지 빌더',
  '/admin/theme': '테마 편집',
  '/admin/reviews': '리뷰 쇼케이스 관리',
  '/admin/carousel': '메인 배너 (캐러셀) 관리',
  '/admin/promo-banners': '프로모 배너 관리',
  '/admin/sub-hero': '서브 히어로 배너 관리',
  '/admin/worldwide': '쇼핑 월드와이드 관리',
  '/admin/menus': '메뉴 관리',
  '/admin/posts': '전체 게시글 관리',
  '/admin/shorts': '숏츠 관리',
  '/admin/instagram': '인스타그램 관리',
  '/admin/chatbot': '챗봇 관리',
  '/admin/registration': '회원가입 관리',
  '/admin/payments': '결제 시스템 관리',
  '/admin/legal': '법적 사항 관리',
};

// Map admin sections to the public URL that previews what the admin just
// edited. Used by the "스토어에서 보기" header link so the admin doesn't have
// to navigate the storefront manually after a save. Sections that have no
// meaningful public preview (users, assets, payments, etc.) return null and
// the link is hidden.
function previewUrlFor(pathname: string): string | null {
  if (pathname === '/admin') return '/kr';
  if (pathname.startsWith('/admin/products/')) {
    const id = pathname.split('/').pop();
    return id && id !== 'new' ? `/kr/products/${id}` : '/kr/products';
  }
  if (pathname === '/admin/products') return '/kr/products';
  if (pathname === '/admin/categories') return '/kr/products';
  if (pathname === '/admin/worldwide') return '/kr/worldwide';
  if (pathname === '/admin/registration') return '/register';
  if (pathname.startsWith('/admin/legal')) return '/kr/menus/contact';
  // Homepage-driving sections all preview the home page itself.
  const previewsHome = ['/admin/carousel', '/admin/sub-hero', '/admin/promo-banners',
                       '/admin/shorts', '/admin/instagram', '/admin/reviews',
                       '/admin/theme', '/admin/logo', '/admin/pages', '/admin/menus',
                       '/admin/posts', '/admin/chatbot'];
  if (previewsHome.some(p => pathname === p || pathname.startsWith(p + '/'))) return '/kr';
  return null;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Close mobile drawer on route change so the admin lands on the new page
  // instead of staring at the menu they just clicked. setState in an effect
  // is intentional here — no render cycle, just reacting to navigation.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  // Cmd/Ctrl+K opens the global search modal. Same shortcut shape as
  // VSCode/Linear/Notion so muscle memory carries over.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const previewUrl = previewUrlFor(pathname);
  const title = PAGE_TITLE[pathname] ?? pathname.split('/').pop() ?? '관리자';

  // /admin/homepage is the Cafe24-style builder that owns its own chrome
  // (top toolbar + section list + preview). Render its children straight
  // through so the global sidebar + header don't compete with it visually.
  // Songyi can leave via the builder's own 종료 (exit) button which deep-
  // links to /admin (dashboard).
  if (pathname === '/admin/homepage') {
    return (
      <div className="h-screen w-screen bg-[#f5f6f8] font-sans overflow-hidden">
        {children}
        <AdminSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
      </div>
    );
  }

  const normalChrome = (
    /* Body bg #f5f6f8 matches Cafe24's admin panel exactly — slightly
       cooler than gray-50 so the content cards lift off the surface
       the way Cafe24's do. */
    <div className="flex h-screen bg-[#f5f6f8] font-sans">
      {/* Mobile backdrop — sits between content and drawer; tap to dismiss. */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static column on md+. Cafe24
          shell: deeper navy slab, tight per-row spacing, uppercase
          section labels, blue accent stripe on the active route. The
          width drops to 232px so the main content gets more room (Cafe24
          equivalent runs ~220-240). */}
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
            onClick={() => setDrawerOpen(false)}
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
                    className={`group flex items-center gap-2.5 pl-3 pr-2 py-2 rounded transition-colors text-[12.5px] ${
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
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-400 hover:text-white hover:bg-[#243049] rounded transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            스토어 보기
          </Link>
          <button
            onClick={() => {
              document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
              window.location.href = '/';
            }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-[12.5px] text-gray-400 hover:text-white hover:bg-[#243049] rounded transition-colors border-none bg-transparent"
          >
            <LogOut className="w-3.5 h-3.5" />
            로그아웃
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto md:ml-0">
        {/* Top bar — Cafe24-style chrome: store selector chip, viewport
            toggle, central search, action icons row, gradient AI button
            on the right. Functionality wired through the existing
            handlers; this is a visual restyle so the shell reads like
            the reference admin. */}
        <header className="h-14 bg-white border-b border-[#e5e7eb] flex items-center px-3 sm:px-5 gap-2 sm:gap-3 sticky top-0 z-30">
          <button
            type="button"
            className="md:hidden text-gray-600 hover:text-black"
            onClick={() => setDrawerOpen(true)}
            aria-label="메뉴 열기"
          >
            <MenuIcon className="w-5 h-5" />
          </button>

          {/* Page title — kept compact like Cafe24's left-anchored label. */}
          <Suspense fallback={null}>
            <BackToHubLink />
          </Suspense>
          <h1 className="text-[14px] font-semibold text-[#1f2937] truncate">{title}</h1>

          {/* Store selector chip — Cafe24 has "(기본) 한국어 쇼핑몰" dropdown
              here. We have one storefront, so this is read-only; the chip
              shape matches the reference. */}
          <div className="hidden md:flex items-center gap-1.5 ml-3 px-2.5 py-1 text-[12px] text-[#1f2937] border border-[#e5e7eb] rounded bg-white hover:bg-[#f9fafb] cursor-default">
            <span className="text-[#6b7280]">(기본)</span>
            <span>한국어 쇼핑몰</span>
            <ChevronDown className="w-3 h-3 text-[#9ca3af]" />
          </div>

          {/* Viewport toggle — purely visual; the homepage builder owns
              the real preview switch. Mirrors Cafe24's PC/Mobile chips. */}
          <div className="hidden lg:flex items-center gap-0.5 ml-1.5 p-0.5 border border-[#e5e7eb] rounded bg-[#fafbfc]">
            <button
              type="button"
              className="p-1 rounded bg-white text-[#1f2937] shadow-sm cursor-default"
              aria-label="PC 미리보기"
            >
              <Monitor className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              className="p-1 rounded text-[#9ca3af] hover:text-[#1f2937] cursor-default"
              aria-label="모바일 미리보기"
            >
              <Smartphone className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex-1" />

          {/* Search button — Cafe24's center-anchored search becomes a
              right-side button here; ⌘K still opens AdminSearchModal. */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="hidden sm:flex items-center gap-2 px-2.5 py-1.5 text-[12px] text-[#6b7280] bg-[#f3f4f6] hover:bg-[#e5e7eb] rounded transition-colors"
            aria-label="전역 검색"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden md:inline">통합 검색</span>
            <kbd className="hidden md:inline ml-1 px-1 py-0.5 text-[9px] font-mono bg-white border border-[#e5e7eb] rounded">⌘K</kbd>
          </button>

          {/* Cafe24's notification + help + bookmark cluster. Wired to
              do nothing visible yet — bell counter is the only piece
              that could light up if we ever attach real notifications. */}
          <button
            type="button"
            className="hidden sm:flex relative w-8 h-8 items-center justify-center text-[#6b7280] hover:text-[#1f2937] hover:bg-[#f3f4f6] rounded transition-colors"
            aria-label="도움말"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
          <button
            type="button"
            className="hidden sm:flex relative w-8 h-8 items-center justify-center text-[#6b7280] hover:text-[#1f2937] hover:bg-[#f3f4f6] rounded transition-colors"
            aria-label="알림"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 bg-[#ef4444] rounded-full" />
          </button>

          {/* Store-view CTA only shows when the current page has a public
              preview equivalent — Cafe24's "사이트 게시" badge analogue. */}
          {previewUrl && (
            <Link
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:flex items-center gap-1.5 px-2.5 py-1.5 text-[12px] text-[#1f2937] border border-[#e5e7eb] hover:bg-[#f9fafb] rounded transition-colors"
            >
              <Eye className="w-3.5 h-3.5" />
              <span className="hidden md:inline">스토어 보기</span>
            </Link>
          )}

          {/* AI assistant pill — Cafe24's "카페24 AI 챗봇" gradient button.
              Decorative placeholder for the eventual in-admin AI surface;
              clicking opens the existing search modal so it isn't a dead
              control for the operator. */}
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 text-[12px] font-semibold text-white rounded-full bg-gradient-to-r from-[#7c3aed] via-[#6366f1] to-[#3b82f6] hover:opacity-90 transition-opacity shadow-sm"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">KOKKOK AI</span>
          </button>
        </header>
        <div className="p-4 sm:p-6">
          {children}
        </div>
      </main>

      <AdminSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );

  // When loaded inside /admin/homepage's slide-in editor drawer
  // (`?embedded=true`), EmbeddedShell strips the sidebar + header so
  // the editor fills the drawer pane. Suspense fallback is the normal
  // chrome so the SSR'd HTML matches the unembedded common case —
  // avoids a sidebar flash on iframe load in the drawer.
  return (
    <ToastProvider>
      <Suspense fallback={normalChrome}>
        <EmbeddedShell fallback={normalChrome}>
          {children}
        </EmbeddedShell>
      </Suspense>
    </ToastProvider>
  );
}
