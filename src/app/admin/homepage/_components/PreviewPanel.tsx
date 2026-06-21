'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Eye, ExternalLink } from 'lucide-react';
import type { ViewportMode } from './types';

/**
 * Live storefront preview pane sitting to the right of the section
 * rail + (optional) editor drawer. A storefront /kr iframe under a
 * thin header bar that reports the viewport width and offers a
 * new-tab escape. Extracted from /admin/homepage/page.tsx at
 * 2026-06-21.
 *
 * Loading state: the iframe boots blank until the storefront hydrates
 * (1-2s on a cold visit). Audit 2026-06-21 final pass added an overlay
 * spinner that fades once `load` fires so operators don't stare at a
 * blank white frame.
 */

interface Props {
  frameStyle: React.CSSProperties;
  viewport: ViewportMode;
  viewportWidth: { pc: number; mobile: number };
  /** Bump this number to force the iframe to remount and reload its src. */
  iframeKey: number;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
}

export default function PreviewPanel({
  frameStyle,
  viewport,
  viewportWidth,
  iframeKey,
  iframeRef,
}: Props) {
  const [loaded, setLoaded] = useState(false);
  // Reset to "loading" whenever the iframe key bumps (admin clicked
  // refresh / changed section / etc). Accepted codebase pattern — same
  // disable used in admin/layout.tsx for the drawer-close-on-route.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoaded(false);
  }, [iframeKey]);

  return (
    <section className="flex-1 overflow-auto bg-[#f5f6f8] p-4 sm:p-6 flex justify-center items-start">
      <div
        className="bg-white shadow-md overflow-hidden flex-shrink-0 relative"
        style={{
          ...frameStyle,
          minHeight: '100%',
          borderRadius: frameStyle.borderRadius ?? '6px',
        }}
      >
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#e5e7eb] bg-[#fafbfc] text-[11px] text-[#6b7280]">
          <span className="flex items-center gap-1.5">
            <Eye className="w-3 h-3" /> 실시간 미리보기
            <span className="text-[#9ca3af]">·</span>
            <span className="font-mono">
              {viewport === 'fit'
                ? '전체 폭'
                : viewport === 'mobile'
                ? `${viewportWidth.mobile}px (모바일)`
                : `${viewportWidth.pc}px (PC)`}
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
          onLoad={() => setLoaded(true)}
        />
        {/* Loading overlay — fades out once the iframe's load event
            fires. pointer-events-none after fade so the iframe stays
            interactable. Matches the rest of the admin's gray pulse
            empty-state idiom (CafeWidgets.EmptyState). */}
        <div
          className={`absolute inset-x-0 bottom-0 top-9 flex flex-col items-center justify-center gap-2 bg-[#fafbfc]/90 transition-opacity duration-200 ${
            loaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
          aria-hidden={loaded}
        >
          <div className="w-5 h-5 border-2 border-[#d1d5db] border-t-[#3b82f6] rounded-full animate-spin" />
          <p className="text-[11px] text-[#9ca3af] font-medium">미리보기 불러오는 중...</p>
        </div>
      </div>
    </section>
  );
}
