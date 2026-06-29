import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { isBannerKey } from '@/lib/api/sectionOrder';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import { useHomepageSections, type HomepageBanner } from './useHomepageSections';
import { useHomepageData } from './useHomepageData';

const CORE_REORDERABLE = new Set([
  'carousel', 'promo-banners', 'products', 'shorts', 'sub-hero', 'instagram', 'reviews', 'top-viewed',
]);

/**
 * Owns the /admin/homepage builder's full state + handler surface:
 * - Section + banner data loaders (via useHomepageData)
 * - The grouped SectionDef list (via useHomepageSections)
 * - Selection + editor-drawer keys, iframe ref + iframe-key remount counter
 * - Drag-and-drop handlers (dragStart/Over/Drop/End) reordering only the
 *   storefront-controlled section keys (theme/logo/menus stay pinned)
 * - The postMessage bridge that relays embedded-editor live previews
 *   (theme tokens + slide form) into the central 1440px storefront iframe
 * - Add-banner / drawer-close handlers including the banner-refresh-on-close
 *   so the rail reflects renamed/recolored banners without a full reload
 *
 * Returned bag wires straight into the builder page — every callback the
 * sub-components need is here.
 */
export function useHomepageBuilder() {
  const toast = useToast();
  const [selectedKey, setSelectedKey] = useState<string>('carousel');
  const [iframeKey, setIframeKey] = useState(0);
  // editingKey: null = drawer closed, otherwise the section key being edited.
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const {
    sectionOrder, setSectionOrder,
    banners, setBanners,
    counts, isLoading,
  } = useHomepageData();

  const grouped = useHomepageSections({ counts, sectionOrder, banners });

  // Bridge: any embedded editor (theme, logo, etc.) posts its live-preview
  // tokens up to this window. Forward them to the central storefront iframe
  // so the admin sees changes against the real site while editing inside
  // the drawer — no in-drawer iframe needed.
  //
  // Audit 2026-06-21: relaying e.data unchecked across an iframe boundary
  // is an XSS surface — a future sender could attach unexpected fields
  // (e.g. javascript: link_url). Each relayed type now passes a shape
  // check before the forward; unknown fields get stripped.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== 'object') return;
      const data = e.data as { type?: unknown };
      let safe: unknown = null;
      if (data.type === 'kokkok-theme-tokens') {
        const css = (data as { css?: unknown }).css;
        if (typeof css === 'string' && css.length < 200_000) {
          safe = { type: 'kokkok-theme-tokens', css };
        }
      } else if (data.type === 'kokkok-builder-slide-preview') {
        const d = data as { slideId?: unknown; override?: unknown };
        const slideIdOk = d.slideId === null || typeof d.slideId === 'string';
        const overrideOk = d.override === null || (typeof d.override === 'object' && d.override !== null);
        if (slideIdOk && overrideOk) {
          safe = { type: 'kokkok-builder-slide-preview', slideId: d.slideId, override: d.override };
        }
      } else if (
        data.type === 'kokkok-builder-subhero-preview'
        || data.type === 'kokkok-builder-topstripe-preview'
        || data.type === 'kokkok-builder-topviewed-preview'
      ) {
        // Single-row sections (one sub-hero, one top stripe) — override is
        // a shallow object of presentation fields; no id discrimination
        // needed since the storefront only renders one of each.
        const d = data as { override?: unknown };
        const overrideOk = d.override === null || (typeof d.override === 'object' && d.override !== null);
        if (overrideOk) {
          safe = { type: data.type, override: d.override };
        }
      } else if (data.type === 'kokkok-builder-banner-preview') {
        // Multi-row inline banners — each storefront <HomepageBanner>
        // filters by bannerId so a single broadcast only updates the
        // banner being edited in the drawer.
        const d = data as { bannerId?: unknown; override?: unknown };
        const bannerIdOk = d.bannerId === null || typeof d.bannerId === 'string';
        const overrideOk = d.override === null || (typeof d.override === 'object' && d.override !== null);
        if (bannerIdOk && overrideOk) {
          safe = { type: 'kokkok-builder-banner-preview', bannerId: d.bannerId, override: d.override };
        }
      } else if (data.type === 'kokkok-builder-promo-preview') {
        // 2-slot promo grid — override is the full banners array so the
        // storefront can overlay both slots in one paint. Validate it's
        // an array; downstream component does per-row shape merging.
        const d = data as { banners?: unknown };
        if (d.banners === null || Array.isArray(d.banners)) {
          safe = { type: 'kokkok-builder-promo-preview', banners: d.banners };
        }
      }
      if (!safe) return;
      const iframe = iframeRef.current;
      if (!iframe?.contentWindow) return;
      iframe.contentWindow.postMessage(safe, window.location.origin);
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  const handleReload = useCallback(() => setIframeKey(k => k + 1), []);

  const handleSelect = useCallback((key: string) => {
    setSelectedKey(key);
    const iframe = iframeRef.current;
    if (!iframe || !iframe.contentWindow) return;
    iframe.contentWindow.postMessage(
      { type: 'kokkok-builder-highlight', sectionKey: key },
      window.location.origin,
    );
  }, []);

  const handleEdit = useCallback((key: string) => {
    setSelectedKey(key);
    setEditingKey(key);
  }, []);

  const isReorderable = (k: string) => CORE_REORDERABLE.has(k) || isBannerKey(k);

  async function saveSectionOrder(next: string[]) {
    try {
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: [{ key: 'homepage_section_order', value: JSON.stringify(next) }] }),
      });
      if (!res.ok) throw new Error('http_' + res.status);
      revalidateHomepageData('homepage_section_order');
    } catch (err) {
      console.error('[admin/homepage] section order save failed:', err);
    }
  }

  const handleDragStart = useCallback((key: string, e: React.DragEvent) => {
    setDragKey(key);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', key);
  }, []);
  const handleDragOver = useCallback((key: string, e: React.DragEvent) => {
    if (!dragKey || dragKey === key) return;
    if (!isReorderable(key)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverKey(key);
  }, [dragKey]);
  const handleDrop = useCallback((targetKey: string, e: React.DragEvent) => {
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
    setIframeKey(k => k + 1);
  }, [dragKey, sectionOrder, setSectionOrder]);
  const handleDragEnd = useCallback(() => {
    setDragKey(null);
    setDragOverKey(null);
  }, []);

  const handleAddBanner = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/crud/homepage_banners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: { kr: '' },
          bg_color: '#1f2937',
          text_color: '#ffffff',
          is_active: true,
        }),
      });
      if (!res.ok) throw new Error('http_' + res.status);
      const json = (await res.json()) as { row?: HomepageBanner };
      const data = json.row;
      if (!data) throw new Error('insert returned no row');
      const newKey = `banner:${data.id}`;
      setBanners(prev => [...prev, data]);
      // Insert new key right before the first homepage section (carousel)
      // so it lands at the top of the page body but below global chrome.
      // Operator can drag from there.
      const next = [...sectionOrder];
      const insertIdx = next.findIndex(k => k === 'carousel');
      if (insertIdx >= 0) next.splice(insertIdx, 0, newKey);
      else next.unshift(newKey);
      setSectionOrder(next);
      void saveSectionOrder(next);
      revalidateHomepageData('homepage_banners');
      setIframeKey(k => k + 1);
      handleEdit(newKey);
    } catch (err) {
      console.error('[admin/homepage] add banner failed:', err);
      toast.show('띠배너 추가에 실패했습니다.', 'error');
    }
  }, [sectionOrder, setBanners, setSectionOrder, handleEdit, toast]);

  const handleDrawerClose = useCallback(() => {
    const wasEditingBanner = editingKey && isBannerKey(editingKey);
    setEditingKey(null);
    // Bump preview iframe key so it remounts and pulls fresh data —
    // covers the "I saved inside the drawer, now show me the result"
    // flow without each editor broadcasting a save event.
    setIframeKey(k => k + 1);
    // Banner edits change the section card's display text + visibility
    // hint. Re-fetch on close so the rail shows the new state instead
    // of the stale snapshot from mount.
    if (wasEditingBanner) {
      (async () => {
        const res = await fetch('/api/admin/crud/homepage_banners', { cache: 'no-store' });
        if (res.ok) {
          const j = (await res.json()) as { rows?: HomepageBanner[] };
          if (j.rows) setBanners(j.rows);
        }
      })().catch(err => console.error('[admin/homepage] banner refresh failed:', err));
    }
  }, [editingKey, setBanners]);

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

  // Memoize the return bag so consumers that destructure into memoized
  // child components don't see a new object identity on every render.
  // Audit 2026-06-21: useHomepageBuilder is called by FullSectionRail
  // which renders ~70 SectionDef cards; without this the drag handlers
  // re-trigger memos every keystroke in unrelated state.
  return useMemo(() => ({
    grouped, isLoading,
    selectedKey, editingKey,
    dragOverKey, isReorderable,
    iframeKey, iframeRef,
    editingSection,
    handleReload, handleSelect, handleEdit,
    handleDragStart, handleDragOver, handleDrop, handleDragEnd,
    handleAddBanner, handleDrawerClose,
  }), [
    grouped, isLoading, selectedKey, editingKey, dragOverKey, iframeKey,
    editingSection, handleReload, handleSelect, handleEdit,
    handleDragStart, handleDragOver, handleDrop, handleDragEnd,
    handleAddBanner, handleDrawerClose,
  ]);
}
