'use client';

import { RefreshCw, Heart, Users, Package, Activity, Repeat, AlertTriangle } from 'lucide-react';
import { useMemo } from 'react';
import { StatCard } from '@/components/admin/CafeWidgets';
import {
  DailyVisitChart,
  VisitFunnelPanel,
  CountryBreakdownPanel,
  WishlistRanksPanel,
  ProductClicksTable,
  TrafficSourcesPanel,
  SearchKeywordsPanel,
} from './_components/DashboardCharts';
import DateRangeControl from './_components/DateRangeControl';
import { useDashboardData } from './_components/useDashboardData';

/**
 * /admin — Cafe24 analytics-style dashboard.
 *
 * Visit / member / wishlist windows follow the date range picker at the
 * top (presets: 오늘 / 7일 / 30일 / 90일 / 직접 선택). The hook computes
 * a same-length prior window automatically so trend % stays meaningful
 * as the range changes. Order/sales data is still missing (KCP is a
 * Phase 2 deploy), so the funnel collapses to three stages and the
 * top-right is left for traffic-source + search-keyword analysis.
 */
export default function AdminDashboard() {
  const { data, isLoading, range, setRange, presets, fetchAll, source } = useDashboardData();
  const sourceLabel = source === 'rds' ? 'RDS 연결됨' : source === 'supabase' ? 'Supabase 연결됨' : 'DB 미연결';

  function trend(curr: number, prev: number): number | null {
    if (prev === 0) return curr > 0 ? 100 : null;
    return Math.round(((curr - prev) / prev) * 100);
  }

  const visitTrend = useMemo(() => trend(data.visits, data.visitsPrev), [data]);
  const memberTrend = useMemo(() => trend(data.newMembers, data.newMembersPrev), [data]);
  const wishTrend = useMemo(() => trend(data.wishlistAdds, data.wishlistAddsPrev), [data]);

  // Visit funnel — analogue of Cafe24's purchase funnel. Cart / order
  // events aren't captured yet, so this collapses to three stages and
  // uses lifetime totals so the operator can read overall conversion
  // independently of the current range filter.
  const funnel = useMemo(() => {
    const visit = data.totalVisits;
    const detail = data.productDetailViews;
    const wish = data.totalWishlist;
    const max = Math.max(visit, detail, wish, 1);
    return [
      { label: '방문', value: visit, pct: 100 },
      { label: '상품 상세 조회', value: detail, pct: visit ? Math.round((detail / visit) * 100) : 0, ratio: Math.round((detail / max) * 100) },
      { label: '위시리스트 추가', value: wish, pct: visit ? Math.round((wish / visit) * 100) : 0, ratio: Math.round((wish / max) * 100) },
    ];
  }, [data]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${data.isLive ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />
            <span className="text-[11px] font-semibold text-[#6b7280]">
              {sourceLabel}
            </span>
          </div>
          <span className="text-[11px] text-[#9ca3af]">·</span>
          <span className="text-[11px] text-[#6b7280] font-medium">{range.label}</span>
        </div>
        <button onClick={fetchAll} disabled={isLoading}
          className="text-[11px] text-[#6b7280] hover:text-[#1f2937] flex items-center gap-1 transition-colors">
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </div>

      <DateRangeControl range={range} presets={presets} onChange={setRange} />

      {data.truncated && (
        <div className="flex items-start gap-2 px-3 py-2 rounded border border-[#fde68a] bg-[#fffbeb] text-[11px] text-[#92400e]">
          <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
          <span>
            선택한 기간에 방문이 너무 많아 최신 20,000건만 표시됩니다. 더 좁은 기간을 선택하면 정확한 합계를 볼 수 있습니다.
          </span>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          accent="#3b82f6"
          label="총 방문수"
          value={data.visits}
          isLoading={isLoading}
          trend={visitTrend}
          subLabel={`누적 ${data.totalVisits.toLocaleString()}`}
          icon={Activity}
        />
        <StatCard
          accent="#22c55e"
          label="신규 회원"
          value={data.newMembers}
          isLoading={isLoading}
          trend={memberTrend}
          subLabel={`누적 ${data.totalMembers.toLocaleString()}명`}
          icon={Users}
        />
        <StatCard
          accent="#f59e0b"
          label="게시중 상품"
          value={data.activeProducts}
          isLoading={isLoading}
          subLabel={`전체 ${data.totalProducts}개 중`}
          icon={Package}
        />
        <StatCard
          accent="#ef4444"
          label="위시리스트 추가"
          value={data.wishlistAdds}
          isLoading={isLoading}
          trend={wishTrend}
          subLabel={`누적 ${data.totalWishlist.toLocaleString()}건`}
          icon={Heart}
        />
      </div>

      {/* Returning-visitor stat — derived from analytics.ip_hash. Shows
          the share of unique IPs in the selected range that visited more
          than once, which is Cafe24's "방문자/재방문" pairing. */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          accent="#8b5cf6"
          label="순 방문자"
          value={data.uniqueVisitors}
          isLoading={isLoading}
          subLabel="동일 IP 1회 카운트"
          icon={Users}
        />
        <StatCard
          accent="#06b6d4"
          label="재방문자"
          value={data.returningVisitors}
          isLoading={isLoading}
          subLabel={data.uniqueVisitors
            ? `순 방문자의 ${Math.round((data.returningVisitors / data.uniqueVisitors) * 100)}%`
            : '데이터 누적 중'}
          icon={Repeat}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <DailyVisitChart dailyVisits={data.dailyVisits} dateRangeLabel={range.label} />
        <VisitFunnelPanel funnel={funnel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <CountryBreakdownPanel countries={data.countries} />
        <TrafficSourcesPanel sources={data.trafficSources} />
        <WishlistRanksPanel wishRanks={data.wishRanks} />
      </div>

      <SearchKeywordsPanel keywords={data.searchKeywords} />

      <ProductClicksTable productClicks={data.productClicks} />
    </div>
  );
}
