import {
  Users, Package, Video, LayoutDashboard, Tag, MenuSquare,
  Image, GalleryHorizontal, PanelTop, Heart, MessageCircle, UserPlus, CreditCard,
  Scale, Globe, ImagePlus, Star, FileText, FolderOpen, Palette, Layers,
  Home as HomeIcon,
} from 'lucide-react';

export type NavItem = { name: string; href: string; icon: React.ComponentType<{ className?: string }> };
export type NavSection = { title: string | null; items: NavItem[] };

// Reorganized 2026-06-19 to match Cafe24's admin layout closer to the
// boss's reference. Key moves:
//   1. 메뉴 관리 pinned to the top (per boss directive — most-touched
//      global config, was buried under "발행 & 페이지" before).
//   2. 성분 태그 dropped from the sidebar — the admin page was deleted
//      to reduce surface area; existing tags persist in the DB and the
//      storefront keeps rendering them until a follow-up cleanup pass.
//   3. Groups renamed to Cafe24 vocabulary: 상품 · 고객 · 게시판 ·
//      디자인 · 콘텐츠 · 설정.
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
