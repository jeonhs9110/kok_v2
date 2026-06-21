'use client';

import { useState } from 'react';
import TopToolbar from './_components/TopToolbar';
import EditorDrawer from './_components/EditorDrawer';
import CollapsedRail from './_components/CollapsedRail';
import PreviewPanel from './_components/PreviewPanel';
import FullSectionRail from './_components/FullSectionRail';
import type { ViewportMode } from './_components/types';
import { useHomepageBuilder } from './_components/useHomepageBuilder';

/**
 * /admin/homepage — Cafe24-style page builder hub.
 *
 * Visual chrome modeled on Cafe24's builder: dark slate top toolbar with
 * skin/page/device controls, a white section-list rail on the left, and a
 * live storefront iframe centered in a soft-gray preview pane. The
 * 2026-06-10 boss meeting + operator feedback drove every styling choice.
 *
 * admin/layout opts out for this route (admin/layout.tsx detects the
 * pathname) so the builder owns the full viewport. The 종료 button in
 * the toolbar deep-links back to /admin for navigation parity.
 */

// Viewport widths mirror what the storefront actually renders at: 1440 =
// desktop screenshot dimension, 390 = iPhone 14 width.
const VIEWPORT_WIDTH: Record<Exclude<ViewportMode, 'fit'>, number> = {
  pc: 1440,
  mobile: 390,
};

export default function HomepageBuilderPage() {
  const [viewport, setViewport] = useState<ViewportMode>('pc');
  const b = useHomepageBuilder();

  // Preview pane sizing.
  // 'pc'     → fixed 1440 frame
  // 'mobile' → fixed 390 phone frame (rounded corners + border)
  // 'fit'    → 100% of pane (no fixed width)
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
        onReload={b.handleReload}
      />

      <div className="flex-1 flex overflow-hidden">
        {/* LEFT RAIL: full section list (default) OR icon-only collapse
            (when an editor is open). The collapse is the operator's
            2026-06-10 ask — keep nav visible as icons so they can switch
            sections without closing the editor. */}
        {b.editingKey ? (
          <CollapsedRail
            grouped={b.grouped}
            editingKey={b.editingKey}
            onEdit={b.handleEdit}
          />
        ) : (
          <FullSectionRail
            grouped={b.grouped}
            isLoading={b.isLoading}
            selectedKey={b.selectedKey}
            dragOverKey={b.dragOverKey}
            onSelect={b.handleSelect}
            onEdit={b.handleEdit}
            onAddBanner={b.handleAddBanner}
            isReorderable={b.isReorderable}
            onDragStart={b.handleDragStart}
            onDragOver={b.handleDragOver}
            onDrop={b.handleDrop}
            onDragEnd={b.handleDragEnd}
          />
        )}

        {/* INLINE EDITOR PANEL: between the collapsed icon rail + central
            preview when an editor is open. */}
        {b.editingSection && (
          <EditorDrawer
            sectionKey={b.editingSection.key}
            sectionName={b.editingSection.name}
            href={b.editingSection.href}
            onClose={b.handleDrawerClose}
          />
        )}

        {/* RIGHT: live preview */}
        <PreviewPanel
          frameStyle={previewFrameStyle}
          viewport={viewport}
          viewportWidth={VIEWPORT_WIDTH}
          iframeKey={b.iframeKey}
          iframeRef={b.iframeRef}
        />
      </div>
    </div>
  );
}
