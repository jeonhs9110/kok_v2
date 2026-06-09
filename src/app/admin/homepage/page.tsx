'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
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
  RefreshCw,
  Monitor,
  Smartphone,
  Eye,
  ExternalLink,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import SectionCard, { type SectionDef } from './_components/SectionCard';

// Session-aware client. We only run COUNT queries below; no writes.
const supabase = getSupabaseBrowser();

/**
 * /admin/homepage — the Cafe24-style hub page Songyi asked for at the
 * 2026-06-10 follow-up. Left column lists every section that renders
 * on the storefront homepage (in render order). Right column is a live
 * iframe of /kr that swaps between PC and Mobile viewport widths via
 * the toggle at the top.
 *
 * Phase 1 MVP intentionally does NOT slide the section's editor in as
 * a panel — clicking the pencil deep-links into the existing
 * /admin/<section> page with ?from=homepage so the layout header
 * shows a "← 홈페이지 빌더로 돌아가기" breadcrumb. The slide-in pattern
 * lands in Phase 1.5 once the existing editors are extracted into
 * reusable panel components.
 */

type ViewportMode = 'pc' | 'mobile';

// Viewport widths chosen to match what the storefront actually renders
// at: 1440 = the desktop screenshot dimension, 390 = iPhone 14 width
// (matches the audit screenshots from earlier this session).
const VIEWPORT_WIDTH: Record<ViewportMode, number> = {
  pc: 1440,
  mobile: 390,
};

interface SectionCounts {
  // Counts queried up-front so the section status badges can read
  // "활성 3개" / "활성 2개 / 비공개 1개" without each card re-fetching.
  carouselActive: number;
  carouselTotal: number;
  promoBannersActive: number;
  promoBannersTotal: number;
  productsActive: number;
  productsTotal: number;
  shortsTotal: number;
  subHeroActive: number;
  subHeroTotal: number;
  instagramHandle: string | null;
  instagramPosts: number;
  reviewsActive: number;
  reviewsTotal: number;
}

const EMPTY_COUNTS: SectionCounts = {
  carouselActive: 0, carouselTotal: 0,
  promoBannersActive: 0, promoBannersTotal: 0,
  productsActive: 0, productsTotal: 0,
  shortsTotal: 0,
  subHeroActive: 0, subHeroTotal: 0,
  instagramHandle: null, instagramPosts: 0,
  reviewsActive: 0, reviewsTotal: 0,
};

export default function HomepageBuilderPage() {
  const [viewport, setViewport] = useState<ViewportMode>('pc');
  const [selectedKey, setSelectedKey] = useState<string>('carousel');
  const [iframeKey, setIframeKey] = useState(0);
  const [counts, setCounts] = useState<SectionCounts>(EMPTY_COUNTS);
  // Initial isLoading derives from supabase availability so we don't have
  // to call setIsLoading(false) synchronously inside the effect below —
  // React 19's no-sync-set-state-in-effect rule (react-hooks/set-state-
  // in-effect) flags that pattern as a cascading-render risk. When
  // supabase is null (server build / no env) we start ready and skip
  // the fetch entirely.
  const [isLoading, setIsLoading] = useState(supabase !== null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load every section's count concurrently. Errors per query degrade
  // to 0 instead of crashing the whole hub — Songyi should never see a
  // blank page just because one of seven queries hiccuped.
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const [
        carouselAll, carouselActive,
        promoAll, promoActive,
        productsAll, productsActive,
        shorts,
        subHeroAll, subHeroActive,
        igConfig, igPosts,
        reviewsAll, reviewsActive,
      ] = await Promise.all([
        supabase.from('carousel_slides').select('id', { count: 'exact', head: true }),
        supabase.from('carousel_slides').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('promo_banners').select('id', { count: 'exact', head: true }),
        supabase.from('promo_banners').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('shorts').select('id', { count: 'exact', head: true }),
        supabase.from('sub_hero_banners').select('id', { count: 'exact', head: true }),
        supabase.from('sub_hero_banners').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('instagram_config').select('handle').maybeSingle(),
        supabase.from('instagram_posts').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('review_cards').select('id', { count: 'exact', head: true }),
        supabase.from('review_cards').select('id', { count: 'exact', head: true }).eq('is_active', true),
      ]);
      setCounts({
        carouselTotal:      carouselAll.count ?? 0,
        carouselActive:     carouselActive.count ?? 0,
        promoBannersTotal:  promoAll.count ?? 0,
        promoBannersActive: promoActive.count ?? 0,
        productsTotal:      productsAll.count ?? 0,
        productsActive:     productsActive.count ?? 0,
        shortsTotal:        shorts.count ?? 0,
        subHeroTotal:       subHeroAll.count ?? 0,
        subHeroActive:      subHeroActive.count ?? 0,
        instagramHandle:    (igConfig.data as { handle: string } | null)?.handle ?? null,
        instagramPosts:     igPosts.count ?? 0,
        reviewsTotal:       reviewsAll.count ?? 0,
        reviewsActive:      reviewsActive.count ?? 0,
      });
      setIsLoading(false);
    })().catch(err => {
      console.error('[admin/homepage] count fetch failed:', err);
      setIsLoading(false);
    });
  }, []);

  // Section list — order matches the actual render order in
  // src/app/[lang]/page.tsx so the cards mirror the live preview top-to-bottom.
  // The theme/logo cards are pinned at the top as "site chrome" (they
  // affect every page, not just the home), the way Cafe24 groups
  // 헤더/로고/메뉴 above the per-section list.
  const sections: SectionDef[] = useMemo(() => [
    {
      key: 'theme',
      name: '테마 (색상 / 폰트)',
      icon: Palette,
      href: '/admin/theme',
      status: '전역 적용',
      visible: true,
      hint: '브랜드 색상 / 폰트 / 버튼 모양 / 메인 배너 크기',
    },
    {
      key: 'logo',
      name: '로고 및 배경',
      icon: ImagePlus,
      href: '/admin/logo',
      status: '전역 적용',
      visible: true,
      hint: '헤더 로고 이미지, 사이트 배경 미디어',
    },
    {
      key: 'menus',
      name: '메뉴 / 네비게이션',
      icon: MenuSquare,
      href: '/admin/menus',
      status: '전역 적용',
      visible: true,
      hint: '상단 메뉴 항목, 메뉴 페이지 콘텐츠',
    },
    {
      key: 'carousel',
      name: '메인 캐러셀',
      icon: ImageIcon,
      href: '/admin/carousel',
      status: countsLabel(counts.carouselActive, counts.carouselTotal),
      visible: counts.carouselActive > 0,
      hint: '히어로 슬라이드 (이미지 + 텍스트 오버레이)',
    },
    {
      key: 'promo-banners',
      name: '프로모 배너',
      icon: GalleryHorizontal,
      href: '/admin/promo-banners',
      status: countsLabel(counts.promoBannersActive, counts.promoBannersTotal),
      visible: counts.promoBannersActive > 0,
      hint: '캐러셀 바로 아래 2분할 배너',
    },
    {
      key: 'products',
      name: '추천 상품 (BEST SELLER)',
      icon: Package,
      href: '/admin/products',
      status: countsLabel(counts.productsActive, counts.productsTotal, '상품'),
      visible: counts.productsActive > 0,
      hint: '홈 메인 BEST SELLER 행에 노출되는 상품',
    },
    {
      key: 'shorts',
      name: '쇼츠',
      icon: Video,
      href: '/admin/shorts',
      status: counts.shortsTotal > 0 ? `${counts.shortsTotal}개` : '데이터 없음',
      visible: counts.shortsTotal > 0,
      hint: 'YouTube Shorts 큐레이션',
    },
    {
      key: 'sub-hero',
      name: '서브 히어로 (와이드)',
      icon: PanelTop,
      href: '/admin/sub-hero',
      status: countsLabel(counts.subHeroActive, counts.subHeroTotal),
      visible: counts.subHeroActive > 0,
      hint: '쇼츠 아래 와이드 텍스트-위-이미지 배너',
    },
    {
      key: 'instagram',
      name: '인스타그램',
      icon: Heart,
      href: '/admin/instagram',
      status: counts.instagramHandle
        ? `@${counts.instagramHandle} · ${counts.instagramPosts}개`
        : '핸들 미설정',
      visible: !!counts.instagramHandle,
      hint: '@핸들 + 포스트 그리드',
    },
    {
      key: 'reviews',
      name: '리뷰 쇼케이스',
      icon: Star,
      href: '/admin/reviews',
      status: countsLabel(counts.reviewsActive, counts.reviewsTotal),
      // Reviews are NOT currently on the homepage main page (removed
      // in PR #126 per boss meeting). The /menus/review page still
      // renders them — keeping the card so Songyi can find it.
      visible: counts.reviewsActive > 0,
      hint: '/menus/review 페이지에 노출 (홈 메인은 아님)',
    },
    {
      key: 'footer',
      name: '푸터 / 사업자정보',
      icon: Scale,
      href: '/admin/legal',
      status: '전역 적용',
      visible: true,
      hint: '회사명, 주소, 전화, 이메일, 약관',
    },
  ], [counts]);

  const handleReload = () => {
    setIframeKey(k => k + 1);
  };

  const previewWidth = VIEWPORT_WIDTH[viewport];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-4 h-[calc(100vh-160px)]">
      {/* ── LEFT: Section list ─────────────────────────────────────── */}
      <aside className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-bold text-gray-800">홈페이지 섹션</h2>
          <p className="text-[11px] text-gray-500 mt-0.5">
            카드를 클릭하면 오른쪽 미리보기와 함께 보고, 연필 아이콘으로 편집합니다.
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {isLoading ? (
            <div className="text-center text-sm text-gray-400 py-12">불러오는 중...</div>
          ) : (
            sections.map(section => (
              <SectionCard
                key={section.key}
                section={section}
                selected={selectedKey === section.key}
                onSelect={() => setSelectedKey(section.key)}
              />
            ))
          )}
        </div>
        <div className="p-3 border-t border-gray-100 bg-gray-50/50">
          <Link
            href="/kr"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-xs font-semibold text-gray-600 border border-gray-200 rounded hover:bg-white transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            새 탭에서 사이트 열기
          </Link>
        </div>
      </aside>

      {/* ── RIGHT: Live preview ────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-gray-200 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">실시간 미리보기</span>
            <span className="text-[11px] text-gray-400 hidden sm:inline">
              · {viewport === 'pc' ? `${previewWidth}px` : `${previewWidth}px (모바일)`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {/* PC / 모바일 toggle — mirrors Cafe24's top-bar device picker
                Songyi pointed at. Swapping width re-runs the storefront's
                responsive breakpoints inside the iframe without a reload. */}
            <div className="inline-flex bg-gray-100 rounded p-0.5 text-[11px] font-bold">
              <button
                type="button"
                onClick={() => setViewport('pc')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                  viewport === 'pc' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'
                }`}
                aria-pressed={viewport === 'pc'}
              >
                <Monitor className="w-3.5 h-3.5" /> PC
              </button>
              <button
                type="button"
                onClick={() => setViewport('mobile')}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded transition-colors ${
                  viewport === 'mobile' ? 'bg-white shadow-sm text-black' : 'text-gray-500 hover:text-black'
                }`}
                aria-pressed={viewport === 'mobile'}
              >
                <Smartphone className="w-3.5 h-3.5" /> 모바일
              </button>
            </div>
            <button
              type="button"
              onClick={handleReload}
              className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-gray-500 hover:text-black border border-gray-200 rounded transition-colors"
              title="미리보기 새로고침"
            >
              <RefreshCw className="w-3 h-3" /> 새로고침
            </button>
          </div>
        </div>
        <div className="flex-1 bg-gray-100 overflow-auto flex items-start justify-center p-3">
          {/* Width-pinned iframe so the storefront's responsive breakpoints
              (sm 640 / lg 1024 in tailwind) fire the way Songyi sees them
              on her actual devices. The mobile preview is shown at a
              phone-shaped frame so it doesn't get lost in the wide
              container; the PC preview spans the full pane width. */}
          <div
            className="bg-white shadow-sm"
            style={{
              width: viewport === 'mobile' ? `${previewWidth}px` : '100%',
              maxWidth: viewport === 'pc' ? `${previewWidth}px` : `${previewWidth}px`,
              minHeight: '100%',
              borderRadius: viewport === 'mobile' ? '24px' : '4px',
              overflow: 'hidden',
              border: viewport === 'mobile' ? '1px solid #d4d4d8' : 'none',
            }}
          >
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src="/kr"
              title="홈페이지 미리보기"
              className="w-full h-full"
              style={{ minHeight: 'calc(100vh - 220px)' }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}

/**
 * Render "활성 N개" / "활성 N개 / 비공개 M개" / "데이터 없음" based on
 * the active/total split. Single source of truth so the cards read
 * consistently.
 */
function countsLabel(active: number, total: number, unit = '개'): string {
  if (total === 0) return '데이터 없음';
  const inactive = total - active;
  if (inactive === 0) return `활성 ${active}${unit}`;
  return `활성 ${active}${unit} / 비공개 ${inactive}${unit}`;
}
