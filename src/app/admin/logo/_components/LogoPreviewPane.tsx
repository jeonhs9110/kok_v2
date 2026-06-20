'use client';

import { Eye, RefreshCw } from 'lucide-react';

/**
 * Sticky right-side storefront preview for /admin/logo. iframe to /kr
 * with a thin header bar offering "새로고침" (force-reload via key bump)
 * and "새 탭" (escape to a real tab). The parent owns the iframe ref
 * and the key counter; this component just renders the chrome.
 *
 * Hidden when the page is rendered inside the /admin/homepage builder
 * drawer (?embedded=true) — the hub's central iframe is the preview
 * there. Extracted from /admin/logo/page.tsx at 2026-06-21.
 */

interface Props {
  iframeKey: number;
  iframeRef?: React.RefObject<HTMLIFrameElement | null>;
  onReload: () => void;
}

export default function LogoPreviewPane({ iframeKey, iframeRef, onReload }: Props) {
  return (
    <section className="bg-white rounded border border-[#e5e7eb] overflow-hidden flex flex-col xl:sticky xl:top-4 xl:self-start xl:max-h-[calc(100vh-2rem)]">
      <div className="p-3 border-b border-[#e5e7eb] flex items-center justify-between bg-[#fafbfc]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#6b7280]" />
          <span className="text-sm font-bold text-[#374151]">실시간 미리보기</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onReload}
            className="inline-flex items-center gap-1 text-[11px] text-[#6b7280] hover:text-[#1f2937]"
            title="미리보기 새로고침"
          >
            <RefreshCw className="w-3 h-3" /> 새로고침
          </button>
          <a
            href="/kr"
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-[#6b7280] hover:text-[#1f2937] underline"
          >
            새 탭
          </a>
        </div>
      </div>
      <div className="flex-1 min-h-[600px] bg-[#f3f4f6] relative">
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src="/kr"
          className="absolute inset-0 w-full h-full bg-white"
          title="storefront preview"
        />
      </div>
    </section>
  );
}
