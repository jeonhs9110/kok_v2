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
  Eye,
  ExternalLink,
  Plus,
  Code2,
  Megaphone,
} from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { isBannerKey } from '@/lib/api/sectionOrder';
import SectionCard, { type SectionDef } from './_components/SectionCard';
import TopToolbar from './_components/TopToolbar';
import EditorDrawer from './_components/EditorDrawer';
import type { ViewportMode } from './_components/types';

// Session-aware client. Only read-side count queries below.
const supabase = getSupabaseBrowser();

/**
 * /admin/homepage — Cafe24-style page builder hub.
 *
 * Visual chrome modeled on Cafe24's builder: a dark slate top toolbar
 * with skin/page/device controls, a white section-list rail on the
 * left, and a live storefront iframe centered in a soft-gray preview
 * pane. The 2026-06-10 boss meeting + Songyi's feedback drove every
 * styling choice — match Cafe24 closely enough that her muscle memory
 * carries over without re-training.
 *
 * The admin/layout above wraps every other admin route with a sidebar,
 * but this route opts out (admin/layout.tsx detects the pathname) so
 * the builder owns the full viewport. The 종료 button in the toolbar
 * deep-links back to /admin (dashboard) for navigation parity.
 */

// Viewport widths chosen to mirror what the storefront actually renders
// at: 1440 = the desktop screenshot dimension, 390 = iPhone 14 width
// (matches the audit screenshots from earlier this session).
const VIEWPORT_WIDTH: Record<Exclude<ViewportMode, 'fit'>, number> = {
  pc: 1440,
  mobile: 390,
};

interface SectionCounts {
  carouselActive: number;  carouselTotal: number;
  promoBannersActive: number;  promoBannersTotal: number;
  productsActive: number;  productsTotal: number;
  shortsTotal: number;
  subHeroActive: number;  subHeroTotal: number;
  instagramHandle: string | null;  instagramPosts: number;
  reviewsActive: number;  reviewsTotal: number;
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
  // Drawer state — null when closed, holds the section key being edited
  // when open. The matching SectionDef is looked up from `grouped` to
  // get the display name + href for the iframe url.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  // Operator-controlled homepage section order. Initialized to the
  // storefront's default order (lib/api/sectionOrder.DEFAULT_ORDER);
  // overwritten by the saved DB row on mount. Drag-and-drop in the
  // section list mutates this and saves back to site_settings.
  const [sectionOrder, setSectionOrder] = useState<string[]>([
    'carousel', 'promo-banners', 'products', 'shorts', 'sub-hero', 'instagram',
  ]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  // Inline banners — N rows, each addressable by `banner:<uuid>` in
  // sectionOrder. The hub spawns a new row via the + button next to the
  // homepage-sections group title; each card lets the operator drag it
  // anywhere in the flow and click 편집 to open the banner editor.
  const [banners, setBanners] = useState<Array<{
    id: string; text: Record<string, string>; bg_color: string; text_color: string; is_active: boolean;
  }>>([]);
  // Initial isLoading derives from supabase availability so we never sync
  // setState inside the effect below (react-hooks/set-state-in-effect).
  const [isLoading, setIsLoading] = useState(supabase !== null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load every section's count concurrently. Errors per query degrade to
  // 0 instead of crashing the hub — Songyi should never see a blank page
  // because one of seven queries hiccuped.
  // Load the saved section order on mount alongside section counts.
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'homepage_section_order')
        .maybeSingle();
      if (data?.value) {
        try {
          const parsed = typeof data.value === 'string' ? JSON.parse(data.value) : data.value;
          if (Array.isArray(parsed) && parsed.every(k => typeof k === 'string')) {
            setSectionOrder(parsed);
          }
        } catch { /* keep default */ }
      }
    })().catch(err => console.error('[admin/homepage] section order load failed:', err));
  }, []);

  // Load the operator's inline banners. Same lifecycle as section order
  // — load once on mount; mutations below (add / delete) update local
  // state optimistically and re-fetch isn't necessary because the row
  // shape is small and we control all writes from this page.
  useEffect(() => {
    if (!supabase) return;
    (async () => {
      const { data } = await supabase
        .from('homepage_banners')
        .select('id,text,bg_color,text_color,is_active');
      if (data) setBanners(data as typeof banners);
    })().catch(err => console.error('[admin/homepage] banners load failed:', err));
  }, []);

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

  // Section list, grouped Cafe24-style: site chrome at top, page sections
  // in render order, then footer. Render order mirrors src/app/[lang]/page.tsx
  // so the cards visually match the iframe top-to-bottom.
  const grouped = useMemo<Array<{ title: string; sections: SectionDef[] }>>(() => ([
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
          // Boss directive 2026-06-19: integrate the review showcase
          // into the homepage builder. The reviews currently render on
          // /menus/review (not the home main), so the card sits at the
          // bottom of the homepage section list rather than in a
          // separate group. Drag-reorder still skips it (it has no
          // sectionOrder slot yet) — when reviews-on-homepage ships in
          // a follow-up, the card automatically joins the drag-list.
          key: 'reviews', name: '리뷰 쇼케이스', icon: Star,
          href: '/admin/reviews',
          status: countsLabel(counts.reviewsActive, counts.reviewsTotal),
          visible: counts.reviewsActive > 0,
          hint: '현재 /menus/review에 노출',
        },
      ],
    },
    {
      title: '표시 설정 / 기타',
      // Non-reorderable config pages that aren't actually homepage
      // sections — separated from the drag-list group so the operator
      // doesn't try to drag them (they have no sectionOrder slot).
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
    // Apply the operator's saved order to the '홈페이지 섹션' group.
    // Reviews + other non-reorderable keys stay at the end of their
    // group in their original spot. Inline banner cards (key
    // 'banner:<uuid>') are injected wherever they appear in
    // sectionOrder; any banner row not in the saved order is
    // appended at the end so a freshly-added banner is never lost.
    if (group.title !== '홈페이지 섹션 (위에서 아래로)') return group;
    const coreById = new Map(group.sections.map(s => [s.key, s]));
    const bannerById = new Map(banners.map(b => [b.id, b]));
    const ordered: SectionDef[] = [];
    const seenCore = new Set<string>();
    const seenBanner = new Set<string>();
    const bannerDef = (b: typeof banners[number]): SectionDef => {
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

  const handleReload = () => setIframeKey(k => k + 1);

  // Bridge: any embedded editor (theme, logo, etc.) posts its live-
  // preview tokens up to this window. We forward them to the central
  // storefront iframe so the admin sees changes against the real site
  // while editing inside the drawer — no in-drawer iframe needed.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== 'object') return;
      // Whitelist the message types we relay. Everything else is
      // either ours-only (highlight, drawer close) or unrelated.
      // kokkok-builder-slide-preview carries in-flight slide modal
      // form changes through to the storefront's HeroSlider so the
      // central 1440px preview reflects edits before save.
      if (
        e.data.type !== 'kokkok-theme-tokens' &&
        e.data.type !== 'kokkok-builder-slide-preview'
      ) return;
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      iframe.contentWindow.postMessage(e.data, window.location.origin);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Scroll + highlight the matching section inside the storefront iframe
  // when the admin clicks a card. The iframe's [lang]/layout script
  // listens for the 'kokkok-builder-highlight' postMessage and applies
  // a temporary outline (.kokkok-builder-highlight) + smooth-scrolls
  // the target into view.
  //
  // Section keys here map 1:1 onto the data-builder-section attribute
  // on the storefront DOM. Keys without a matching element (e.g.
  // 'theme' — global tokens, no specific node) silently no-op.
  function handleSelect(key: string) {
    setSelectedKey(key);
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: 'kokkok-builder-highlight', sectionKey: key },
      window.location.origin,
    );
  }

  function handleEdit(key: string) {
    setSelectedKey(key);
    setEditingKey(key);
  }

  // Drag-and-drop handlers for the 홈페이지 섹션 group. Reordering is
  // optimistic (local state updates immediately, then we persist).
  // The reorderable key set is the same one the storefront's section
  // map covers — global chrome rows (theme, logo, menus, top-stripe,
  // footer) stay fixed in their group.
  const CORE_REORDERABLE = new Set(['carousel','promo-banners','products','shorts','sub-hero','instagram']);
  const isReorderable = (k: string) => CORE_REORDERABLE.has(k) || isBannerKey(k);

  async function saveSectionOrder(next: string[]) {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          { key: 'homepage_section_order', value: JSON.stringify(next), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
    } catch (err) {
      console.error('[admin/homepage] section order save failed:', err);
    }
  }

  function handleDragStart(key: string, e: React.DragEvent) {
    setDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  }
  function handleDragOver(key: string, e: React.DragEvent) {
    if (!dragKey || dragKey === key) return;
    if (!isReorderable(key)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverKey(key);
  }
  function handleDrop(targetKey: string, e: React.DragEvent) {
    e.preventDefault();
    if (!dragKey || dragKey === targetKey) return;
    if (!isReorderable(targetKey) || !isReorderable(dragKey)) return;
    const onlyReorderable = sectionOrder.filter(k => isReorderable(k));
    const from = onlyReorderable.indexOf(dragKey);
    const to = onlyReorderable.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    const next = [...onlyReorderable];
    next.splice(from, 1);
    next.splice(to, 0, dragKey);
    setSectionOrder(next);
    setDragOverKey(null);
    void saveSectionOrder(next);
    // Bump the preview iframe so the new order is reflected.
    setIframeKey(k => k + 1);
  }
  function handleDragEnd() {
    setDragKey(null);
    setDragOverKey(null);
  }

  // Spawn a new inline banner. Inserts an empty row in homepage_banners,
  // prepends 'banner:<uuid>' to the homepage-section group of the
  // sectionOrder (so it lands at the top of the homepage; operator can
  // drag it where they want), then opens the edit drawer on it. If
  // anything fails we surface a brief alert and leave state untouched.
  async function handleAddBanner() {
    if (!supabase) return;
    try {
      const { data, error } = await supabase
        .from('homepage_banners')
        .insert({
          text: { kr: '' },
          bg_color: '#1f2937',
          text_color: '#ffffff',
          is_active: true,
        })
        .select('id,text,bg_color,text_color,is_active')
        .single();
      if (error || !data) throw error || new Error('insert returned no row');
      const newKey = `banner:${data.id}`;
      setBanners(prev => [...prev, data as typeof banners[number]]);
      // Insert the new key right before the first homepage section
      // (carousel) so it lands at the top of the page body but below
      // the global chrome. Operator can drag from there.
      const next = [...sectionOrder];
      const insertIdx = next.findIndex(k => k === 'carousel');
      if (insertIdx >= 0) next.splice(insertIdx, 0, newKey);
      else next.unshift(newKey);
      setSectionOrder(next);
      void saveSectionOrder(next);
      setIframeKey(k => k + 1);
      handleEdit(newKey);
    } catch (err) {
      console.error('[admin/homepage] add banner failed:', err);
      alert('띠배너 추가에 실패했습니다.');
    }
  }

  function handleDrawerClose() {
    const wasEditingBanner = editingKey && isBannerKey(editingKey);
    setEditingKey(null);
    // Bump the preview iframe key so it remounts and pulls fresh data
    // — covers the "I saved inside the drawer, now show me the result"
    // flow without needing each editor to broadcast a save event.
    setIframeKey(k => k + 1);
    // Banner edits change the section card's display text + visibility
    // hint. Re-fetch on close so the rail shows the new state instead
    // of the stale snapshot from mount. Other editors don't change
    // their own card metadata, so we skip the round-trip for them.
    if (wasEditingBanner && supabase) {
      (async () => {
        const { data } = await supabase!
          .from('homepage_banners')
          .select('id,text,bg_color,text_color,is_active');
        if (data) setBanners(data as typeof banners);
      })().catch(err => console.error('[admin/homepage] banner refresh failed:', err));
    }
  }

  // Find the section currently being edited so we can hand the drawer
  // its name + href without re-searching at render time.
  const editingSection = useMemo(() => {
    if (!editingKey) return null;
    for (const group of grouped) {
      const found = group.sections.find(s => s.key === editingKey);
      if (found) return found;
    }
    return null;
  }, [editingKey, grouped]);

  // ── Preview pane sizing ──
  // 'pc'    → fixed 1440 frame
  // 'mobile'→ fixed 390 phone frame (rounded corners + border)
  // 'fit'   → 100% of pane (no fixed width)
  const previewFrameStyle: React.CSSProperties = (() => {
    if (viewport === 'fit') return { width: '100%', maxWidth: 'none' };
    const w = VIEWPORT_WIDTH[viewport];
    if (viewport === 'mobile') {
      return { width: `${w}px`, borderRadius: '24px', border: '1px solid #d4d4d8' };
    }
    return { width: '100%', maxWidth: `${w}px` };
  })();

  return (
    <div className="h-screen w-screen flex flex-col bg-[#f5f6f8] font-sans">
      <TopToolbar
        viewport={viewport}
        onViewportChange={setViewport}
        onReload={handleReload}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* ── LEFT RAIL: full section list (default) OR icon-only
            collapse (when an editor is open). The collapse is the
            operator's 2026-06-10 ask — keep the navigation visible as
            icons so they can switch sections without closing the
            editor, but reclaim the 260px width for the editor panel +
            preview. Selection state + click-to-switch still work in
            both modes. */}
        {editingKey ? (
          <CollapsedRail
            grouped={grouped}
            editingKey={editingKey}
            onEdit={handleEdit}
          />
        ) : (
          <aside className="w-[320px] bg-white border-r border-[#e5e7eb] flex flex-col overflow-hidden flex-shrink-0">
            <div className="flex border-b border-[#e5e7eb] bg-[#f9fafb]">
              <TabButton active>섹션</TabButton>
              <TabButton href="/admin/theme?from=homepage">스타일</TabButton>
              <TabButton disabled>확장</TabButton>
            </div>

            <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
              {isLoading ? (
                <div className="text-center text-[13px] text-gray-400 py-12">불러오는 중...</div>
              ) : (
                grouped.map(group => (
                  <div key={group.title}>
                    <div className="flex items-center justify-between px-1 pb-2">
                      <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#9ca3af]">
                        {group.title}
                      </p>
                      {group.title === '홈페이지 섹션 (위에서 아래로)' && (
                        <button
                          type="button"
                          onClick={handleAddBanner}
                          className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-[#3b82f6] hover:bg-[#eff6ff] rounded transition-colors"
                          title="섹션 사이에 띠배너 추가"
                        >
                          <Plus className="w-3 h-3" />
                          띠배너
                        </button>
                      )}
                    </div>
                    <div className="space-y-1.5">
                      {group.sections.map(section => {
                        const reorderable = isReorderable(section.key);
                        return (
                          <SectionCard
                            key={section.key}
                            section={section}
                            selected={selectedKey === section.key}
                            onSelect={() => handleSelect(section.key)}
                            onEdit={() => handleEdit(section.key)}
                            draggable={reorderable}
                            onDragStart={reorderable ? e => handleDragStart(section.key, e) : undefined}
                            onDragOver={reorderable ? e => handleDragOver(section.key, e) : undefined}
                            onDrop={reorderable ? e => handleDrop(section.key, e) : undefined}
                            onDragEnd={reorderable ? handleDragEnd : undefined}
                            dragOver={dragOverKey === section.key}
                          />
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-[#e5e7eb] p-3 space-y-2 bg-[#fafbfc] flex-shrink-0">
              <Link
                href="/admin/pages?from=homepage"
                className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-[12px] font-semibold text-[#3b82f6] border border-[#bfdbfe] bg-white rounded hover:bg-[#eff6ff] transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                섹션 추가 (페이지 빌더)
              </Link>
              <Link
                href="/admin/theme?from=homepage"
                className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-[11px] text-[#6b7280] hover:text-[#1f2937] transition-colors"
              >
                <Code2 className="w-3 h-3" />
                테마/HTML 직접 편집
              </Link>
            </div>
          </aside>
        )}

        {/* ── INLINE EDITOR PANEL: sits between the collapsed icon rail
            and the central preview when an editor is open. */}
        {editingSection && (
          <EditorDrawer
            sectionKey={editingSection.key}
            sectionName={editingSection.name}
            href={editingSection.href}
            onClose={handleDrawerClose}
          />
        )}

        {/* ── RIGHT: live preview ────────────────────────────── */}
        <section className="flex-1 overflow-auto bg-[#f5f6f8] p-4 sm:p-6 flex justify-center items-start">
          <div
            className="bg-white shadow-md overflow-hidden flex-shrink-0"
            style={{
              ...previewFrameStyle,
              minHeight: '100%',
              borderRadius: previewFrameStyle.borderRadius ?? '6px',
            }}
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#e5e7eb] bg-[#fafbfc] text-[11px] text-[#6b7280]">
              <span className="flex items-center gap-1.5">
                <Eye className="w-3 h-3" /> 실시간 미리보기
                <span className="text-[#9ca3af]">·</span>
                <span className="font-mono">
                  {viewport === 'fit' ? '전체 폭' :
                   viewport === 'mobile' ? `${VIEWPORT_WIDTH.mobile}px (모바일)` :
                   `${VIEWPORT_WIDTH.pc}px (PC)`}
                </span>
              </span>
              <Link
                href="/kr"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 hover:text-[#1f2937] transition-colors"
              >
                새 탭 <ExternalLink className="w-2.5 h-2.5" />
              </Link>
            </div>
            <iframe
              key={iframeKey}
              ref={iframeRef}
              src="/kr"
              title="홈페이지 미리보기"
              className="w-full bg-white"
              style={{ height: 'calc(100vh - 9rem)', border: 'none', display: 'block' }}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

/**
 * CollapsedRail — icon-only navigation that replaces the full section
 * list when an editor is open. Same selection state as the full rail
 * (active section gets a blue tint + left-border accent); clicking a
 * different icon swaps the editor to that section. Keeps the operator
 * oriented while reclaiming 256px of horizontal space for the editor +
 * preview combo.
 */
function CollapsedRail({
  grouped, editingKey, onEdit,
}: {
  grouped: Array<{ title: string; sections: SectionDef[] }>;
  editingKey: string;
  onEdit: (key: string) => void;
}) {
  return (
    <aside className="w-[64px] bg-white border-r border-[#e5e7eb] flex flex-col overflow-hidden flex-shrink-0">
      <div className="flex-1 overflow-y-auto py-2 space-y-1">
        {grouped.map((group, gi) => (
          <div key={group.title}>
            {/* Thin divider between groups so the operator still gets the
                same visual grouping as the full rail. No labels — those
                live as hover tooltips on each icon button below. */}
            {gi > 0 && <div className="mx-3 my-1 border-t border-[#f3f4f6]" />}
            {group.sections.map(section => {
              const Icon = section.icon;
              const active = editingKey === section.key;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => onEdit(section.key)}
                  className={`w-full h-11 flex items-center justify-center transition-colors relative ${
                    active
                      ? 'bg-[#eff6ff] text-[#3b82f6]'
                      : 'text-[#6b7280] hover:bg-[#f9fafb] hover:text-[#1f2937]'
                  }`}
                  title={section.name}
                  aria-label={section.name}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <span className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r bg-[#3b82f6]" />
                  )}
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </aside>
  );
}

function TabButton({
  children, active = false, disabled = false, href,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  href?: string;
}) {
  const base = `flex-1 py-2.5 text-[12px] font-semibold transition-colors border-b-2 ${
    active
      ? 'border-[#3b82f6] text-[#3b82f6] bg-white'
      : disabled
      ? 'border-transparent text-[#d1d5db] cursor-not-allowed'
      : 'border-transparent text-[#6b7280] hover:text-[#1f2937] hover:bg-white'
  }`;
  if (href && !disabled) {
    return <Link href={href} className={base}>{children}</Link>;
  }
  return <button type="button" className={base} disabled={disabled}>{children}</button>;
}

function countsLabel(active: number, total: number, unit = '개'): string {
  if (total === 0) return '데이터 없음';
  const inactive = total - active;
  if (inactive === 0) return `활성 ${active}${unit}`;
  return `활성 ${active}${unit} · 비공개 ${inactive}${unit}`;
}
