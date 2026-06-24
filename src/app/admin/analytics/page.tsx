'use client';

import { RefreshCw, AlertTriangle } from 'lucide-react';
import DateRangeControl from '../_components/DateRangeControl';
import { useAnalyticsData } from './_components/useAnalyticsData';
import SessionsKpiStrip from './_components/SessionsKpiStrip';
import SessionsTrendChart from './_components/SessionsTrendChart';
import ChannelMixPanel from './_components/ChannelMixPanel';
import KeywordConversionPanel from './_components/KeywordConversionPanel';
import LandingPagesPanel from './_components/LandingPagesPanel';
import HourOfDayHeatmap from './_components/HourOfDayHeatmap';
import DeviceSplitPanel from './_components/DeviceSplitPanel';
import UtmCampaignsPanel from './_components/UtmCampaignsPanel';
import ExportToPdfButton from './_components/ExportToPdfButton';

/**
 * /admin/analytics — marketing analyst view.
 *
 * The main /admin dashboard answers "what's the operational status?"
 * (active products, total members, pending wishlist). This page
 * answers the marketing team's and the CEO's questions instead:
 *   - 어디서 들어왔나?      (channels with engagement quality)
 *   - 무엇을 검색했나?      (keywords with conversion rates)
 *   - 어디로 처음 들어왔나? (landing pages with bounce rates)
 *   - 언제 들어오나?        (time-of-day heatmap for posting / ads)
 *   - 어떤 기기로 보나?     (mobile vs desktop split)
 *   - 어떤 캠페인이 성과있나? (UTM-tagged paid traffic)
 *   - 성장 중인가?          (period-over-period on every KPI)
 *
 * Everything is built on a SESSION abstraction sessionized client-
 * side in useAnalyticsData. Bottom-of-page "PDF로 저장 / 인쇄" hands
 * the whole page to the browser print dialog which the operator can
 * save as a PDF and forward to the CEO.
 */
export default function AnalyticsPage() {
  const { data, isLoading, range, setRange, presets, fetchAll } = useAnalyticsData();

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${data.isLive ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />
            <span className="text-[11px] font-semibold text-[#6b7280]">
              {data.isLive ? '분석 가능' : '데이터 대기'}
            </span>
          </div>
          <span className="text-[11px] text-[#9ca3af]">·</span>
          <span className="text-[11px] text-[#6b7280] font-medium">{range.label}</span>
          {data.pageviewsWithoutIpHash > 0 && (
            <>
              <span className="text-[11px] text-[#9ca3af]">·</span>
              <span className="text-[11px] text-[#9ca3af]">
                구버전 로그 {data.pageviewsWithoutIpHash.toLocaleString()}건은 세션 분석에서 제외됨
              </span>
            </>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchAll}
            disabled={isLoading}
            className="text-[11px] text-[#6b7280] hover:text-[#1f2937] flex items-center gap-1 transition-colors"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> 새로고침
          </button>
        </div>
      </div>

      <DateRangeControl range={range} presets={presets} onChange={setRange} />

      {data.truncated && (
        <div className="flex items-start gap-2 px-3 py-2 rounded border border-[#fde68a] bg-[#fffbeb] text-[11px] text-[#92400e]">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            선택한 기간에 페이지뷰가 너무 많아 최신 20,000건만 분석에 포함됩니다. 더 좁은 기간을 선택하면 정확한 세션 수를 볼 수 있습니다.
          </span>
        </div>
      )}

      <SessionsKpiStrip
        sessions={data.sessions}
        engagedSessions={data.engagedSessions}
        bounceRate={data.bounceRate}
        avgPagesPerSession={data.avgPagesPerSession}
        prior={data.prior}
        isLoading={isLoading}
      />

      <SessionsTrendChart sessionsByDay={data.sessionsByDay} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <ChannelMixPanel channels={data.channels} />
        <DeviceSplitPanel devices={data.devices} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <KeywordConversionPanel keywords={data.keywords} />
        <UtmCampaignsPanel utmCampaigns={data.utmCampaigns} />
      </div>

      <LandingPagesPanel landingPages={data.landingPages} />

      <div>
        <HourOfDayHeatmap
          heatmap={data.heatmap}
          peakHour={data.peakHour}
          peakDow={data.peakDow}
        />
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-[#e5e7eb]">
        <span className="text-[11px] text-[#9ca3af]">
          분석 리포트 PDF — 표지 + 핵심 지표 + 채널/기기/검색어/캠페인/랜딩/시간대 (4페이지)
        </span>
        <ExportToPdfButton data={data} range={range} />
      </div>
    </div>
  );
}
