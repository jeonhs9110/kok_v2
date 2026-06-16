'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { X, ExternalLink } from 'lucide-react';

/**
 * EditorDrawer — inline left-side panel that hosts a section's editor
 * inside the /admin/homepage builder. The iframe points at the same
 * /admin/<section> route the pencil chevron used to navigate to,
 * but adds ?embedded=true so the admin layout strips its global
 * sidebar + header and the editor fills the panel.
 *
 * 2026-06-10 refactor: was a right-side fixed overlay; now sits in
 * the page's flex layout between the (collapsed) icon rail on its
 * left and the central preview on its right. The operator's mental
 * model — "section list ↓ icon collapse ← editor slides in ← preview
 * stays right of the editor" — only works if the editor is in the
 * flow, not floating on top.
 *
 * Close paths:
 *   - X button
 *   - Escape key
 *   - postMessage('kokkok-builder-editor-close') from the embedded page
 */
interface Props {
  sectionKey: string;
  sectionName: string;
  href: string;
  onClose: () => void;
}

export default function EditorDrawer({
  sectionKey, sectionName, href, onClose,
}: Props) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ESC closes the panel.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Listen for save/close signals from the embedded editor.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (e.origin !== window.location.origin) return;
      if (!e.data || typeof e.data !== 'object') return;
      if (e.data.type === 'kokkok-builder-editor-close') onClose();
    }
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [onClose]);

  // ?embedded=true tells admin/layout.tsx to render bare children.
  // ?from=homepage keeps the back-to-hub breadcrumb visible inside
  // the embedded view (so power users can navigate out if they need
  // the full sidebar after all).
  const url = `${href}?embedded=true&from=homepage&section=${sectionKey}`;

  return (
    <aside
      className="w-full sm:w-[400px] lg:w-[440px] bg-white border-r border-[#e5e7eb] flex flex-col flex-shrink-0 animate-in slide-in-from-left duration-200"
      role="dialog"
      aria-label={`${sectionName} 편집`}
    >
      {/* Header — dark slate to match the top toolbar so the editor
          visually belongs to the builder shell. */}
      <div className="h-12 bg-[#2a2d3e] text-white flex items-center px-3 gap-2 flex-shrink-0">
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

      {/* Embedded editor iframe — fills the rest of the panel. */}
      <iframe
        ref={iframeRef}
        src={url}
        title={`${sectionName} 편집`}
        className="flex-1 w-full bg-white"
        style={{ border: 'none' }}
      />
    </aside>
  );
}
