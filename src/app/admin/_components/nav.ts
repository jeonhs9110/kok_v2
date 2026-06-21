import {
  Users, Package, LayoutDashboard, Tag, MenuSquare,
  MessageCircle, UserPlus, CreditCard,
  Scale, Globe, FileText, FolderOpen, Layers,
  Home as HomeIcon,
} from 'lucide-react';

export type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
export type NavSection = { title: string | null; items: NavItem[] };

// 2026-06-21 collapse: the 디자인 + 콘텐츠 sections previously listed every
// homepage section (캐러셀 / 서브히어로 / 프로모 / 상단 띠배너 / 쇼츠 /
// 인스타 / 리뷰 / 테마 / 로고) as their own sidebar items. Every one of
// those is already accessible as a section card inside /admin/homepage
// (the Cafe24-style hub with slide-in editor panels + live preview), so
// the sidebar duplication was cognitive load with no information gain.
//
// What stays under 디자인:
//   - 홈페이지 빌더: the hub itself — the single entry point to all
//     header / homepage / footer section editors.
//   - 에셋 라이브러리: cross-cutting media manager (used across products,
//     posts, pages — not section-bound), keep as a top-level surface.
//   - 페이지 빌더: builds *separate* event/promo pages, not the homepage —
//     genuinely a different surface from the hub.
//
// The deep URLs (/admin/theme, /admin/carousel, etc.) still resolve so
// muscle-memory + deep-links from emails keep working. They're just not
// advertised in the menu anymore — the path the operator should reach
// for is /admin/homepage → click the section card.
export const NAV_SECTIONS: NavSection[] = [
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
      { name: '홈페이지 빌더', href: '/admin/homepage', icon: HomeIcon },
      { name: '에셋 라이브러리', href: '/admin/assets', icon: FolderOpen },
      { name: '페이지 빌더', href: '/admin/pages', icon: Layers },
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

export const PAGE_TITLE: Record<string, string> = {
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
export function previewUrlFor(pathname: string): string | null {
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
