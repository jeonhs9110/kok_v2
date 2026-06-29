import { useMemo } from 'react';
import {
  Image as ImageIcon,
  GalleryHorizontal,
  Package,
  Video,
  PanelTop,
  Heart,
  Star,
  Palette,
  ImagePlus,
  MenuSquare,
  Scale,
  Megaphone,
  TrendingUp,
} from 'lucide-react';
import { isBannerKey } from '@/lib/api/sectionOrder';
import type { SectionDef } from './SectionCard';

/**
 * Section counts pulled in by /admin/homepage. Each (active / total) pair
 * shapes the "활성 N개 · 비공개 M개" sub-label on the matching card.
 */
export interface SectionCounts {
  carouselActive: number;  carouselTotal: number;
  promoBannersActive: number;  promoBannersTotal: number;
  productsActive: number;  productsTotal: number;
  shortsTotal: number;
  subHeroActive: number;  subHeroTotal: number;
  instagramHandle: string | null;  instagramPosts: number;
  reviewsActive: number;  reviewsTotal: number;
}

export const EMPTY_COUNTS: SectionCounts = {
  carouselActive: 0, carouselTotal: 0,
  promoBannersActive: 0, promoBannersTotal: 0,
  productsActive: 0, productsTotal: 0,
  shortsTotal: 0,
  subHeroActive: 0, subHeroTotal: 0,
  instagramHandle: null, instagramPosts: 0,
  reviewsActive: 0, reviewsTotal: 0,
};

export interface HomepageBanner {
  id: string;
  text: Record<string, string>;
  bg_color: string;
  text_color: string;
  is_active: boolean;
}

function countsLabel(active: number, total: number, unit = '개'): string {
  if (total === 0) return '데이터 없음';
  const inactive = total - active;
  if (inactive === 0) return `활성 ${active}${unit}`;
  return `활성 ${active}${unit} · 비공개 ${inactive}${unit}`;
}

/**
 * Build the Cafe24-style grouped section list. Site chrome → homepage
 * sections (in operator-saved order) → display config → footer. Render
 * order mirrors src/app/[lang]/page.tsx so cards top-to-bottom on the
 * left rail match the iframe preview on the right.
 */
export function useHomepageSections({
  counts,
  sectionOrder,
  banners,
}: {
  counts: SectionCounts;
  sectionOrder: string[];
  banners: HomepageBanner[];
}): Array<{ title: string; sections: SectionDef[] }> {
  return useMemo<Array<{ title: string; sections: SectionDef[] }>>(() => ([
    {
      title: '사이트 전체',
      sections: [
        {
          key: 'theme', name: '테마 (색상 / 폰트)', icon: Palette,
          href: '/admin/theme', status: '전역 적용', visible: true,
          hint: '브랜드 색상·폰트·버튼 모양·메인 배너 크기',
        },
        {
          key: 'logo', name: '로고 및 배경', icon: ImagePlus,
          href: '/admin/logo', status: '전역 적용', visible: true,
          hint: '헤더 로고 + 사이트 배경 미디어',
        },
        {
          key: 'menus', name: '메뉴 / 네비게이션', icon: MenuSquare,
          href: '/admin/menus', status: '전역 적용', visible: true,
          hint: '상단 메뉴 항목, 메뉴 페이지 콘텐츠',
        },
        {
          key: 'top-stripe', name: '상단 띠배너', icon: PanelTop,
          href: '/admin/top-stripe', status: '전역 적용', visible: true,
          hint: '헤더 위 얇은 띠 (쿠폰/이벤트 안내)',
        },
      ],
    },
    {
      title: '홈페이지 섹션 (위에서 아래로)',
      sections: [
        {
          key: 'carousel', name: '메인 캐러셀', icon: ImageIcon,
          href: '/admin/carousel',
          status: countsLabel(counts.carouselActive, counts.carouselTotal),
          visible: counts.carouselActive > 0,
          hint: '히어로 슬라이드',
        },
        {
          key: 'promo-banners', name: '프로모 배너', icon: GalleryHorizontal,
          href: '/admin/promo-banners',
          status: countsLabel(counts.promoBannersActive, counts.promoBannersTotal),
          visible: counts.promoBannersActive > 0,
          hint: '2분할 배너',
        },
        {
          key: 'products', name: '추천 상품 (BEST SELLER)', icon: Package,
          href: '/admin/products',
          status: countsLabel(counts.productsActive, counts.productsTotal, '상품'),
          visible: counts.productsActive > 0,
          hint: '홈 메인에 노출되는 상품',
        },
        {
          key: 'shorts', name: '쇼츠', icon: Video,
          href: '/admin/shorts',
          status: counts.shortsTotal > 0 ? `${counts.shortsTotal}개` : '데이터 없음',
          visible: counts.shortsTotal > 0,
          hint: 'YouTube Shorts 큐레이션',
        },
        {
          key: 'sub-hero', name: '서브 히어로 (와이드)', icon: PanelTop,
          href: '/admin/sub-hero',
          status: countsLabel(counts.subHeroActive, counts.subHeroTotal),
          visible: counts.subHeroActive > 0,
          hint: '와이드 텍스트-위-이미지 배너',
        },
        {
          key: 'instagram', name: '인스타그램', icon: Heart,
          href: '/admin/instagram',
          status: counts.instagramHandle
            ? `@${counts.instagramHandle} · ${counts.instagramPosts}개`
            : '핸들 미설정',
          visible: !!counts.instagramHandle,
          hint: '@핸들 + 포스트 그리드',
        },
        {
          // Phase C 2026-06-19 — reviews render as a real home section.
          key: 'reviews', name: '리뷰 쇼케이스', icon: Star,
          href: '/admin/reviews',
          status: countsLabel(counts.reviewsActive, counts.reviewsTotal),
          visible: counts.reviewsActive > 0,
          hint: '홈 메인 + /menus/review',
        },
        {
          // Top-viewed editor added 2026-06-29 — surfaced by the homepage
          // builder audit as a fully-uncontrolled section. Auto-populated
          // from analytics; operator now controls title, window, count,
          // and on/off via /admin/top-viewed.
          key: 'top-viewed', name: '인기 상품 (자동)', icon: TrendingUp,
          href: '/admin/top-viewed',
          status: '자동 노출 · 최근 조회수 기준',
          visible: true,
          hint: '최근 N일간 가장 많이 본 상품 (관리자 설정)',
        },
      ],
    },
    {
      title: '표시 설정 / 기타',
      sections: [
        {
          key: 'products-display', name: '추천 상품 — 크기/간격', icon: Package,
          href: '/admin/best-seller-display',
          status: '카드 크기 + 간격 + 글씨 + 이미지 비율',
          visible: true,
          hint: '추천 상품 그리드 표시 설정',
        },
      ],
    },
    {
      title: '푸터',
      sections: [
        {
          key: 'footer', name: '푸터 / 사업자정보', icon: Scale,
          href: '/admin/legal', status: '전역 적용', visible: true,
          hint: '회사명, 주소, 전화, 이메일, 약관',
        },
      ],
    },
  ].map(group => {
    // Apply the operator's saved order to the '홈페이지 섹션' group only.
    // Reviews + other non-reorderable keys stay at the end of their group
    // in their original spot. Inline banner cards (key 'banner:<uuid>')
    // are injected wherever they appear in sectionOrder; any banner row
    // not in the saved order is appended at the end so a freshly-added
    // banner is never lost.
    if (group.title !== '홈페이지 섹션 (위에서 아래로)') return group;
    const coreById = new Map(group.sections.map(s => [s.key, s]));
    const bannerById = new Map(banners.map(b => [b.id, b]));
    const ordered: SectionDef[] = [];
    const seenCore = new Set<string>();
    const seenBanner = new Set<string>();
    const bannerDef = (b: HomepageBanner): SectionDef => {
      const preview =
        b.text?.kr || b.text?.en ||
        Object.values(b.text || {}).find(t => t && t.trim()) ||
        '(빈 띠배너)';
      const trimmed = preview.length > 28 ? preview.slice(0, 28) + '…' : preview;
      return {
        key: `banner:${b.id}`,
        name: `띠배너 · ${trimmed}`,
        icon: Megaphone,
        href: `/admin/banners/${b.id}`,
        status: b.is_active ? '활성' : '숨김',
        visible: b.is_active && Object.values(b.text || {}).some(t => t && t.trim()),
        hint: '인라인 띠배너',
      };
    };
    for (const k of sectionOrder) {
      if (isBannerKey(k)) {
        const id = k.slice('banner:'.length);
        const b = bannerById.get(id);
        if (!b) continue;
        seenBanner.add(id);
        ordered.push(bannerDef(b));
        continue;
      }
      const s = coreById.get(k);
      if (s) { ordered.push(s); seenCore.add(k); }
    }
    for (const s of group.sections) {
      if (!seenCore.has(s.key)) ordered.push(s);
    }
    for (const b of banners) {
      if (!seenBanner.has(b.id)) ordered.push(bannerDef(b));
    }
    return { ...group, sections: ordered };
  })), [counts, sectionOrder, banners]);
}
