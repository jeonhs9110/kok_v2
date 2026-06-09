'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import {
  Users, Package, Video, LayoutDashboard, LogOut, ExternalLink, Tag, MenuSquare,
  Image, GalleryHorizontal, PanelTop, Heart, MessageCircle, UserPlus, CreditCard,
  Scale, Globe, ImagePlus, Star, FileText, FolderOpen, Palette, Layers, Search,
  Menu as MenuIcon, X, Eye, Home as HomeIcon,
} from 'lucide-react';
import AdminSearchModal from './_components/AdminSearchModal';
import BackToHubLink from './_components/BackToHubLink';

type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
type NavSection = { title: string | null; items: NavItem[] };

const NAV_SECTIONS: NavSection[] = [
  {
    title: null,
    items: [
      { name: '대시보드', href: '/admin', icon: LayoutDashboard },
    ],
  },
  {
    title: '상품',
    items: [
      { name: '상품 관리', href: '/admin/products', icon: Package },
      { name: '카테고리', href: '/admin/categories', icon: Tag },
      { name: '성분 태그', href: '/admin/ingredient-tags', icon: Tag },
    ],
  },
  {
    title: '홈페이지 레이아웃',
    items: [
      // Boss-meeting follow-up (2026-06-10): the fragmented section
      // pages overwhelmed Songyi. The 홈페이지 빌더 hub pulls them all
      // into one Cafe24-style page so she sees every section in one
      // list with the live storefront preview next to it. Individual
      // pages below still work the same — the hub just deep-links into
      // them with ?from=homepage so the back arrow returns to the hub.
      { name: '홈페이지 빌더', href: '/admin/homepage', icon: HomeIcon },
      { name: '테마 (색상 / 모양)', href: '/admin/theme', icon: Palette },
      { name: '에셋 라이브러리', href: '/admin/assets', icon: FolderOpen },
      { name: '로고 및 배경', href: '/admin/logo', icon: ImagePlus },
      { name: '메인 배너 (캐러셀)', href: '/admin/carousel', icon: Image },
      { name: '서브 히어로 (와이드)', href: '/admin/sub-hero', icon: PanelTop },
      { name: '프로모 배너', href: '/admin/promo-banners', icon: GalleryHorizontal },
      { name: '페이지 빌더', href: '/admin/pages', icon: Layers },
    ],
  },
  {
    title: '홈페이지 콘텐츠',
    items: [
      { name: '숏츠', href: '/admin/shorts', icon: Video },
      { name: '인스타그램', href: '/admin/instagram', icon: Heart },
      { name: '리뷰 쇼케이스', href: '/admin/reviews', icon: Star },
    ],
  },
  {
    title: '발행 & 페이지',
    items: [
      { name: '메뉴 관리', href: '/admin/menus', icon: MenuSquare },
      { name: '게시글 관리', href: '/admin/posts', icon: FileText },
      { name: '쇼핑 월드와이드', href: '/admin/worldwide', icon: Globe },
    ],
  },
  {
    title: '사이트 설정',
    items: [
      { name: '챗봇', href: '/admin/chatbot', icon: MessageCircle },
      { name: '법적 사항 / 비즈니스 정보', href: '/admin/legal', icon: Scale },
    ],
  },
  {
    title: '커머스',
    items: [
      { name: '사용자', href: '/admin/users', icon: Users },
      { name: '회원가입 정책', href: '/admin/registration', icon: UserPlus },
      { name: '결제 시스템', href: '/admin/payments', icon: CreditCard },
    ],
  },
];

const PAGE_TITLE: Record<string, string> = {
  '/admin': '대시보드 개요',
  '/admin/homepage': '홈페이지 빌더',
  '/admin/users': '사용자 관리',
  '/admin/categories': '카테고리 관리',
  '/admin/products': '상품 관리',
  '/admin/logo': '로고 및 배경 관리',
  '/admin/assets': '에셋 라이브러리',
  '/admin/pages': '페이지 빌더',
  '/admin/theme': '테마 편집',
  '/admin/reviews': '리뷰 쇼케이스 관리',
  '/admin/ingredient-tags': '성분 태그 관리',
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
  if (pathname === '/admin/categories' || pathname === '/admin/ingredient-tags') return '/kr/products';
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

  return (
    <div className="flex h-screen bg-gray-50 font-sans">
      {/* Mobile backdrop — sits between content and drawer; tap to dismiss. */}
      {drawerOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-30"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Sidebar — fixed drawer on mobile, static column on md+. */}
      <aside
        className={`fixed md:static inset-y-0 left-0 z-40 w-64 bg-brand-ink text-white flex flex-col transform transition-transform duration-200 ease-out md:transform-none ${
          drawerOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
        }`}
      >
        <div className="h-16 flex items-center justify-between px-6 border-b border-gray-800">
          <span className="text-lg font-bold tracking-widest">관리자 포털</span>
          <button
            type="button"
            className="md:hidden text-gray-400 hover:text-white"
            onClick={() => setDrawerOpen(false)}
            aria-label="메뉴 닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <nav className="flex-1 py-4 px-3 space-y-4 overflow-y-auto">
          {NAV_SECTIONS.map((section, idx) => (
            <div key={idx} className="space-y-1">
              {section.title && (
                <p className="px-3 pt-2 pb-1 text-[10px] font-bold tracking-[0.18em] uppercase text-gray-500">
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
                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm ${
                      isActive ? 'bg-white text-black font-semibold' : 'text-gray-400 hover:text-white hover:bg-gray-800'
                    }`}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{item.name}</span>
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-gray-800 space-y-1">
          <Link
            href="/kr"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
            스토어 보기
          </Link>
          <button
            onClick={() => {
              document.cookie = "kokkok_admin_auth=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
              window.location.href = '/';
            }}
            className="w-full flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors border-none bg-transparent"
          >
            <LogOut className="w-5 h-5" />
            로그아웃
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-auto md:ml-0">
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-4 sm:px-8 shadow-sm gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              className="md:hidden text-gray-600 hover:text-black"
              onClick={() => setDrawerOpen(true)}
              aria-label="메뉴 열기"
            >
              <MenuIcon className="w-6 h-6" />
            </button>
            {/* Back-to-hub breadcrumb — appears whenever an admin landed on
                this page via the homepage builder (?from=homepage). Wrapped
                in <Suspense> because useSearchParams() inside bails out of
                Next.js 16's static prerender pass. Suspense lets the page
                shell prerender while the breadcrumb hydrates on the client. */}
            <Suspense fallback={null}>
              <BackToHubLink />
            </Suspense>
            <h1 className="text-xl font-semibold text-gray-800 truncate">{title}</h1>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-500 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              aria-label="전역 검색"
            >
              <Search className="w-4 h-4" />
              <span className="hidden sm:inline">검색</span>
              <kbd className="hidden md:inline ml-1 px-1.5 py-0.5 text-[10px] font-mono bg-white border border-gray-300 rounded">⌘K</kbd>
            </button>
            {previewUrl && (
              <Link
                href={previewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-white bg-brand-ink hover:bg-black rounded-lg transition-colors"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">스토어에서 보기</span>
              </Link>
            )}
          </div>
        </header>
        <div className="p-4 sm:p-8">
          {children}
        </div>
      </main>

      <AdminSearchModal open={searchOpen} onClose={() => setSearchOpen(false)} />
    </div>
  );
}
