'use client';

import Link from 'next/link';
import { Eye, ExternalLink } from 'lucide-react';
import type { ViewportMode } from './types';

/**
 * Live storefront preview pane sitting to the right of the section
 * rail + (optional) editor drawer. A storefront /kr iframe under a
 * thin header bar that reports the viewport width and offers a
 * new-tab escape. Extracted from /admin/homepage/page.tsx at
 * 2026-06-21.
 */

interface Props {
  /** Outer frame style — width + optional aspect-ratio cap from the
   *  parent's previewFrameStyle calc. */
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
  return (
    <section className="flex-1 overflow-auto bg-[#f5f6f8] p-4 sm:p-6 flex justify-center items-start">
      <div
        className="bg-white shadow-md overflow-hidden flex-shrink-0"
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
        />
      </div>
    </section>
  );
}
