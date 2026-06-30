'use client';

import { useState } from 'react';
import { FileDown, Loader2 } from 'lucide-react';
import { useToast } from '@/components/admin/Toast';
import type { AnalyticsData } from './useAnalyticsData';
import type { DateRange } from '../../_components/useDashboardData';

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
  const toast = useToast();
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

      // Lazy-load @react-pdf/renderer + the dedicated PDF layout component on click.
      // Static imports would drag ~600KB of PDF runtime (font shaper, layout engine,
      // Pretendard font, vector-PDF JSX bridge) into the analytics page's first paint
      // even when the operator never exports. Now it's only fetched on demand.
      const [{ pdf }, { default: AnalyticsReportPdf }] = await Promise.all([
        import('@react-pdf/renderer'),
        import('./AnalyticsReportPdf'),
      ]);

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
      // Toast instead of alert() — modal alerts feel out-of-band in
      // the rest of the admin UI (every other failure path toasts).
      // The full error stays in console for diagnosis.
      console.error('[analytics] PDF generation failed:', err);
      toast.show('PDF 생성에 실패했습니다. 콘솔(F12)에서 상세 오류를 확인하세요.', 'error');
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
          PDF 다운로드
        </>
      )}
    </button>
  );
}
