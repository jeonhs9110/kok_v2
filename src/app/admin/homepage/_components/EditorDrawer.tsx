'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, ExternalLink } from 'lucide-react';

/**
 * EditorDrawer — right-side overlay that hosts a section's editor
 * inside the /admin/homepage builder. The iframe points at the same
 * /admin/<section> route the pencil chevron used to navigate to,
 * but adds ?embedded=true so the admin layout strips its global
 * sidebar + header and the editor fills the drawer pane.
 *
 * Songyi's Cafe24 reference shows the editor sliding in over the
 * preview rather than swapping the whole page. This matches that
 * pattern so she never loses her place in the builder while she's
 * editing.
 *
 * Close paths:
 *   - X button
 *   - Backdrop click
 *   - Escape key
 *   - postMessage('kokkok-builder-editor-close') from the embedded page
 *
 * On every close (regardless of path) the parent bumps a key on the
 * preview iframe so the storefront re-fetches and reflects any saves.
 */
interface Props {
  open: boolean;
  sectionKey: string;
  sectionName: string;
  href: string;
  onClose: () => void;
}

export default function EditorDrawer({
  open, sectionKey, sectionName, href, onClose,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ESC closes the drawer.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Listen for save/close signals from the embedded editor.
  useEffect(() => {
    if (!open) return;
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'kokkok-builder-editor-close') onClose();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [open, onClose]);

  // Lock body scroll while the drawer is open so the page behind
  // doesn't scroll under the backdrop.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  if (!open) return null;

  // ?embedded=true tells admin/layout.tsx to render bare children.
  // ?from=homepage keeps the back-to-hub breadcrumb visible inside
  // the embedded view (so power users can navigate out if they need
  // the full sidebar after all).
  const url = `${href}?embedded=true&from=homepage&section=${sectionKey}`;

  return (
    <>
      {/* Backdrop — dims the storefront preview behind the drawer. */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/40 z-40 animate-in fade-in duration-150"
        aria-hidden="true"
      />

      {/* Drawer panel — slides in from the right at ~720px wide on
          desktop, full width on tablet/mobile. */}
      <aside
        className="fixed right-0 top-0 bottom-0 w-full sm:w-[680px] lg:w-[760px] bg-white z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-200"
        role="dialog"
        aria-label={`${sectionName} 편집`}
      >
        {/* Header */}
        <div className="h-12 bg-[#2a2d3e] text-white flex items-center px-3 gap-3 flex-shrink-0">
          <span className="text-sm font-semibold flex-1 truncate">
            {sectionName} 편집
          </span>
          <Link
            href={`${href}?from=homepage`}
            className="inline-flex items-center gap-1 px-2 py-1 text-[11px] text-white/70 hover:text-white hover:bg-white/10 rounded transition-colors"
            title="별도 페이지에서 열기"
          >
            <ExternalLink className="w-3 h-3" />
            전체 화면
          </Link>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded hover:bg-white/10 transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Embedded editor iframe */}
        <iframe
          ref={iframeRef}
          src={url}
          title={`${sectionName} 편집`}
          className="flex-1 w-full bg-white"
          style={{ border: 'none' }}
        />
      </aside>
    </>
  );
}
