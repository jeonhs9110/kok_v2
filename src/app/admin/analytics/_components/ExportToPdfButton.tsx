'use client';

import { FileDown } from 'lucide-react';

/**
 * "Export to PDF" button — triggers the browser's print dialog. The
 * print CSS (see analytics-print.css) re-skins the page into a clean
 * CEO-ready report: admin chrome hidden, sections forced into clean
 * page breaks, light background guaranteed regardless of dark-mode
 * print settings.
 *
 * We deliberately use window.print() over a jsPDF/html2canvas stack:
 *   - zero bundle cost (no ~200KB library)
 *   - native fonts + ligatures (jsPDF mangles Korean glyphs without
 *     an embedded font file)
 *   - the browser's Save-as-PDF dialog is already familiar to the
 *     boss / CEO and they keep the resulting file in their own
 *     workflow (email, KakaoTalk attachment, drive)
 */
export default function ExportToPdfButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="kokkok-no-print inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded border border-[#1f2937] bg-[#1f2937] text-white hover:bg-[#374151] transition"
    >
      <FileDown className="w-3.5 h-3.5" />
      PDF로 저장 / 인쇄
    </button>
  );
}
