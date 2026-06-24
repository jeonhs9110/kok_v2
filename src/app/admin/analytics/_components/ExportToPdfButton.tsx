'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { pdf } from '@react-pdf/renderer';
import type { AnalyticsData } from './useAnalyticsData';
import type { DateRange } from '../../_components/useDashboardData';
import AnalyticsReportPdf from './AnalyticsReportPdf';

/**
 * Generate-and-download button for the marketing analytics report.
 *
 * NOT window.print() — that produced a half-rendered screenshot of the
 * live admin page (boss reviewed 2026-06-24, refused). This now uses
 * react-pdf to build a real vector PDF from a dedicated layout
 * (cover page → executive summary → channel / device / keyword / UTM
 * / landing / time tables) with native Korean glyphs via Pretendard.
 *
 * Generation happens on click (not eagerly with PDFDownloadLink) so
 * the analytics page first paint isn't blocked by font loading.
 */
export default function ExportToPdfButton({
  data,
  range,
}: {
  data: AnalyticsData;
  range: DateRange;
}) {
  const [busy, setBusy] = useState(false);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    try {
      // Stamp the generation time at click — the cover page + every
      // footer reads from it. Local time matches the operator's KST.
      const d = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const generatedAt = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(
        d.getHours(),
      )}:${pad(d.getMinutes())}`;

      const blob = await pdf(
        <AnalyticsReportPdf data={data} range={range} generatedAt={generatedAt} />,
      ).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const safeRange = range.label.replace(/[\s·~–()]/g, '_').replace(/__+/g, '_');
      a.download = `KOKKOK-마케팅분석-${safeRange}-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(
        d.getDate(),
      )}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Defer revoke so the browser finishes the download stream.
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.error('[analytics] PDF generation failed:', err);
      alert('PDF 생성에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={busy}
      className="kokkok-no-print inline-flex items-center gap-1.5 px-3 py-2 text-[12px] font-bold rounded border border-[#1f2937] bg-[#1f2937] text-white hover:bg-[#374151] disabled:opacity-60 disabled:cursor-not-allowed transition"
    >
      {busy ? (
        <>
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
          PDF 생성 중…
        </>
      ) : (
        <>
          <FileDown className="w-3.5 h-3.5" />
          CEO 리포트 PDF 다운로드
        </>
      )}
    </button>
  );
}
