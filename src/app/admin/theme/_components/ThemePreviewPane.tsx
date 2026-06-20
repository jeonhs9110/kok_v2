'use client';

import type { RefObject } from 'react';
import { Eye } from 'lucide-react';

interface Props {
  previewLang: 'kr' | 'en';
  onPreviewLangChange: (l: 'kr' | 'en') => void;
  iframeRef: RefObject<HTMLIFrameElement | null>;
}

export default function ThemePreviewPane({ previewLang, onPreviewLangChange, iframeRef }: Props) {
  return (
    <section className="bg-white rounded border border-[#e5e7eb] overflow-hidden flex flex-col">
      <div className="p-3 border-b border-[#e5e7eb] flex items-center justify-between bg-[#fafbfc]">
        <div className="flex items-center gap-2">
          <Eye className="w-4 h-4 text-[#6b7280]" />
          <span className="text-sm font-bold text-[#374151]">실시간 미리보기</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex bg-[#f3f4f6] rounded p-0.5 text-[11px] font-bold">
            {(['kr', 'en'] as const).map(l => (
              <button
                key={l}
                type="button"
                onClick={() => onPreviewLangChange(l)}
                className={`px-2.5 py-1 rounded transition ${
                  previewLang === l ? 'bg-white shadow-sm text-[#1f2937]' : 'text-[#6b7280]'
                }`}
              >
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <a
            href={`/${previewLang}`}
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
          ref={iframeRef}
          src={`/${previewLang}`}
          className="absolute inset-0 w-full h-full bg-white"
          title="storefront preview"
        />
      </div>
    </section>
  );
}
