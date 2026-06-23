import {
  Users, Package, LayoutDashboard, Tag, MenuSquare,
  MessageCircle, UserPlus, CreditCard,
  Scale, Globe, FileText, LineChart,
  Home as HomeIcon,
} from 'lucide-react';

export type NavItem = {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Optional red "NEW" chip rendered next to the label, Cafe24-style. */
  isNew?: boolean;
};

// 2026-06-21 rewrite against the actual Cafe24 reference screenshot.
//
// Cafe24's sidebar is a FLAT LIST — no section headers, no collapsible
// groups. Every item is a single row with an icon + label, and the
// active item gets a full blue row-bg (not a slim left-border). The
// ordering follows Cafe24's information hierarchy: 홈 first, then
// commerce (상품 → 고객 → 게시판), then design (디자인 hub), then
// services / global / settings.
//
// Items absent in our admin (주문, 메시지, 프로모션, 통계, 통합엑셀,
// PRO, 메일배송, 유튜브 쇼핑, 마켓플러스, 마케팅, 드랍쉬핑, 판매채널,
// 앱) are intentionally omitted — the boss confirmed those concepts
// don't exist in our product so they shouldn't be in the nav.
//
// Analytics moves out of the sidebar and into the dashboard body
// per the boss's instruction ("put analytics at or below the
// homepage dashboard").
export const NAV_ITEMS: NavItem[] = [
  { name: '홈',                href: '/admin',              icon: LayoutDashboard },
  // 마케팅 관점의 분석 페이지 — 세션 / 채널 / 키워드 / 랜딩 / 시간대.
  // /admin 은 운영 현황 (재고, 가입자, 위시리스트) 중심이고,
  // /admin/analytics 는 "어디서 들어왔고 무엇을 했나"에 답하는
  // 분석가 전용 뷰. 2026-06-24 추가.
  { name: '분석',              href: '/admin/analytics',    icon: LineChart, isNew: true },
  { name: '상품',              href: '/admin/products',     icon: Package },
  // Per boss 2026-06-22: 메뉴 관리 moves up between 상품 and 카테고리
  // so the storefront-content controls (products → menus → categories)
  // sit together, instead of being buried at the bottom under the
  // settings/legal block.
  { name: '메뉴 관리',         href: '/admin/menus',        icon: MenuSquare },
  { name: '카테고리',          href: '/admin/categories',   icon: Tag },
  { name: '고객',              href: '/admin/users',        icon: Users },
  { name: '게시판',            href: '/admin/posts',        icon: FileText },
  { name: '디자인 (PC/모바일)', href: '/admin/homepage',     icon: HomeIcon },
  { name: '글로벌',            href: '/admin/worldwide',    icon: Globe },
  { name: '챗봇',              href: '/admin/chatbot',      icon: MessageCircle },
  { name: '회원가입 정책',     href: '/admin/registration', icon: UserPlus },
  { name: '결제 시스템',       href: '/admin/payments',     icon: CreditCard },
  { name: '법적 사항',         href: '/admin/legal',        icon: Scale },
];

// Back-compat shim so any remaining import of NAV_SECTIONS keeps working.
// The shell now reads NAV_ITEMS directly; NAV_SECTIONS will be removed
// once nothing else references it.
export type NavSection = { title: string | null; items: NavItem[] };
export const NAV_SECTIONS: NavSection[] = [{ title: null, items: NAV_ITEMS }];

export const PAGE_TITLE: Record<string, string> = {
  '/admin': '대시보드 개요',
  '/admin/analytics': '마케팅 분석',
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
