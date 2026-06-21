'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { isBannerKey } from '@/lib/api/sectionOrder';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import TopToolbar from './_components/TopToolbar';
import EditorDrawer from './_components/EditorDrawer';
import CollapsedRail from './_components/CollapsedRail';
import PreviewPanel from './_components/PreviewPanel';
import FullSectionRail from './_components/FullSectionRail';
import type { ViewportMode } from './_components/types';
import { useHomepageSections, type HomepageBanner } from './_components/useHomepageSections';
import { useHomepageData } from './_components/useHomepageData';

// Session-aware client. Only read-side count queries below.
const supabase = getSupabaseBrowser();

/**
 * /admin/homepage — Cafe24-style page builder hub.
 *
 * Visual chrome modeled on Cafe24's builder: a dark slate top toolbar
 * with skin/page/device controls, a white section-list rail on the
 * left, and a live storefront iframe centered in a soft-gray preview
 * pane. The 2026-06-10 boss meeting + operator feedback drove every
 * styling choice — match Cafe24 closely enough that the operator's
 * muscle memory carries over without re-training.
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

export default function HomepageBuilderPage() {
  const toast = useToast();
  const [viewport, setViewport] = useState<ViewportMode>('pc');
  const [selectedKey, setSelectedKey] = useState<string>('carousel');
  const [iframeKey, setIframeKey] = useState(0);
  // Drawer state — null when closed, holds the section key being edited
  // when open. The matching SectionDef is looked up from `grouped` to
  // get the display name + href for the iframe url.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Three-channel loader: saved order + inline banners + per-section
  // counts. Each is independent; an error on one degrades to defaults.
  const {
    sectionOrder, setSectionOrder,
    banners, setBanners,
    counts,
    isLoading,
  } = useHomepageData();

  const grouped = useHomepageSections({ counts, sectionOrder, banners });

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
  const CORE_REORDERABLE = new Set(['carousel','promo-banners','products','shorts','sub-hero','instagram','reviews']);
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
      // Tag eviction so the storefront's unstable_cache wrapper drops
      // the cached order immediately. Previously the section reorder
      // sat stale for up to 60s — audit 2026-06-19 HIGH finding.
      revalidateHomepageData('homepage_section_order');
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
      // Tag eviction so the storefront's unstable_cache wrapper around
      // homepage_banners drops the cached list and picks up the newly
      // inserted row on the next render — audit 2026-06-19 HIGH finding.
      revalidateHomepageData('homepage_banners');
      setIframeKey(k => k + 1);
      handleEdit(newKey);
    } catch (err) {
      console.error('[admin/homepage] add banner failed:', err);
      toast.show('띠배너 추가에 실패했습니다.', 'error');
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
        if (data) setBanners(data as HomepageBanner[]);
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
          <FullSectionRail
            grouped={grouped}
            isLoading={isLoading}
            selectedKey={selectedKey}
            dragOverKey={dragOverKey}
            onSelect={handleSelect}
            onEdit={handleEdit}
            onAddBanner={handleAddBanner}
            isReorderable={isReorderable}
            onDragStart={handleDragStart}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onDragEnd={handleDragEnd}
          />
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
        <PreviewPanel
          frameStyle={previewFrameStyle}
          viewport={viewport}
          viewportWidth={VIEWPORT_WIDTH}
          iframeKey={iframeKey}
          iframeRef={iframeRef}
        />
      </div>
    </div>
  );
}

