'use client';

import { RefreshCw, Heart, Users, Package, Activity } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { StatCard } from '@/components/admin/CafeWidgets';
import {
  DailyVisitChart,
  VisitFunnelPanel,
  CountryBreakdownPanel,
  WishlistRanksPanel,
  ProductClicksTable,
} from './_components/DashboardCharts';
import { useDashboardData } from './_components/useDashboardData';

/**
 * /admin — Cafe24 analytics-style dashboard.
 *
 * We don't have order/sales data (KCP integration is Phase 2 deploy), so
 * the boss's "Cafe24 analytics처럼 구현 가능한 것들만" directive resolves
 * to: keep the Cafe24 visual idiom (left-striped stat cards, 최근 7일 date
 * range, trend % vs previous 7-day window, funnel-shape widgets) and feed
 * it with the data we actually persist — pageviews, users, products,
 * wishlist, reviews.
 */
export default function AdminDashboard() {
  const { data, isLoading, fetchAll } = useDashboardData();

  // % change vs prev window. Returns null when prev is 0 (can't divide).
  function trend(curr: number, prev: number): number | null {
    if (prev === 0) return curr > 0 ? 100 : null;
    return Math.round(((curr - prev) / prev) * 100);
  }

  const visitTrend = useMemo(() => trend(data.visits7d, data.visitsPrev7d), [data]);
  const memberTrend = useMemo(() => trend(data.newMembers7d, data.newMembersPrev7d), [data]);
  const wishTrend = useMemo(() => trend(data.wishlistAdds7d, data.wishlistAddsPrev7d), [data]);

  // Visit funnel — our analogue of Cafe24's purchase funnel. Since we
  // don't capture cart/order events, this collapses to three stages.
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

  const [dateRangeLabel, setDateRangeLabel] = useState('');
  useEffect(() => {
    // Compute on mount so SSR + first client render agree; new Date() in
    // the render body triggers the react-hooks/purity rule.
    const today = new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    const start7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDateRangeLabel(`${start7d} – ${today} (최근 7일)`);
  }, []);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${data.isLive ? 'bg-[#22c55e]' : 'bg-[#f59e0b]'}`} />
            <span className="text-[11px] font-semibold text-[#6b7280]">
              {data.isLive ? 'Supabase 연결됨' : 'DB 미연결'}
            </span>
          </div>
          <span className="text-[11px] text-[#9ca3af]">·</span>
          <span className="text-[11px] text-[#6b7280] font-medium">{dateRangeLabel}</span>
        </div>
        <button onClick={fetchAll} disabled={isLoading}
          className="text-[11px] text-[#6b7280] hover:text-[#1f2937] flex items-center gap-1 transition-colors">
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} /> 새로고침
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard
          accent="#3b82f6"
          label="총 방문수"
          value={data.visits7d}
          isLoading={isLoading}
          trend={visitTrend}
          subLabel={`누적 ${data.totalVisits.toLocaleString()}`}
          icon={Activity}
        />
        <StatCard
          accent="#22c55e"
          label="신규 회원"
          value={data.newMembers7d}
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
          value={data.wishlistAdds7d}
          isLoading={isLoading}
          trend={wishTrend}
          subLabel={`누적 ${data.totalWishlist.toLocaleString()}건`}
          icon={Heart}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <DailyVisitChart dailyVisits={data.dailyVisits} dateRangeLabel={dateRangeLabel} />
        <VisitFunnelPanel funnel={funnel} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <CountryBreakdownPanel countries={data.countries} />
        <WishlistRanksPanel wishRanks={data.wishRanks} />
      </div>

      <ProductClicksTable productClicks={data.productClicks} />
    </div>
  );
}
