'use client';

import { RefreshCw, Heart, Users, Package, Activity } from 'lucide-react';
import { useState, useEffect, useMemo } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard } from '@/components/admin/CafeWidgets';
import {
  DailyVisitChart,
  VisitFunnelPanel,
  CountryBreakdownPanel,
  WishlistRanksPanel,
  ProductClicksTable,
} from './_components/DashboardCharts';

const supabase = getSupabaseBrowser();

/**
 * /admin — Cafe24 analytics-style dashboard.
 *
 * We don't have order/sales data (KCP integration is Phase 2 deploy),
 * so the boss's "Cafe24 analytics처럼 구현 가능한 것들만" directive
 * resolves to: keep the Cafe24 visual idiom (left-striped stat cards,
 * 최근 7일 date range, trend % vs previous 7-day window, funnel-shape
 * widgets) and feed it with the data we actually persist — pageviews,
 * users, products, wishlist, reviews.
 */

interface DashboardData {
  isLive: boolean;
  visits7d: number;
  newMembers7d: number;
  wishlistAdds7d: number;
  visitsPrev7d: number;
  newMembersPrev7d: number;
  wishlistAddsPrev7d: number;
  activeProducts: number;
  totalProducts: number;
  totalMembers: number;
  totalWishlist: number;
  totalVisits: number;
  productDetailViews: number;
  dailyVisits: { date: string; count: number }[];
  countries: { country: string; count: number }[];
  productClicks: { id: string; name: string; clicks: number }[];
  wishRanks: { id: string; name: string; wishCount: number }[];
}

const EMPTY: DashboardData = {
  isLive: false,
  visits7d: 0, newMembers7d: 0, wishlistAdds7d: 0,
  visitsPrev7d: 0, newMembersPrev7d: 0, wishlistAddsPrev7d: 0,
  activeProducts: 0, totalProducts: 0, totalMembers: 0, totalWishlist: 0,
  totalVisits: 0, productDetailViews: 0,
  dailyVisits: [], countries: [], productClicks: [], wishRanks: [],
};

export default function AdminDashboard() {
  const [data, setData] = useState<DashboardData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchAll() {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('No client');

      const now = Date.now();
      const dayMs = 24 * 60 * 60 * 1000;
      const start7d = new Date(now - 7 * dayMs).toISOString();
      const start14d = new Date(now - 14 * dayMs).toISOString();

      const [
        analyticsAll,
        analytics7d,
        analyticsPrev7d,
        productsAll,
        productsActive,
        usersAll,
        users7d,
        usersPrev7d,
        wishAll,
      ] = await Promise.all([
        supabase.from('analytics').select('country, path, created_at'),
        supabase.from('analytics').select('id', { count: 'exact', head: true }).gte('created_at', start7d),
        supabase.from('analytics').select('id', { count: 'exact', head: true }).gte('created_at', start14d).lt('created_at', start7d),
        supabase.from('products').select('id, name, is_active, images'),
        supabase.from('products').select('id', { count: 'exact', head: true }).eq('is_active', true),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', start7d),
        supabase.from('users').select('id', { count: 'exact', head: true }).gte('created_at', start14d).lt('created_at', start7d),
        supabase.from('wishlist').select('product_id, created_at'),
      ]);

      const dailyBuckets: Record<string, number> = {};
      const labels: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(now - i * dayMs);
        const key = d.toISOString().slice(0, 10);
        dailyBuckets[key] = 0;
        labels.push(key);
      }
      const countryMap: Record<string, number> = {};
      const productClickMap: Record<string, number> = {};
      let productDetailViews = 0;
      for (const row of analyticsAll.data ?? []) {
        countryMap[row.country || 'UNKNOWN'] = (countryMap[row.country || 'UNKNOWN'] || 0) + 1;
        const date = row.created_at?.slice(0, 10);
        if (date && date in dailyBuckets) dailyBuckets[date]++;
        const match = row.path?.match(/\/products\/([^/]+)$/);
        if (match) {
          productClickMap[match[1]] = (productClickMap[match[1]] || 0) + 1;
          productDetailViews++;
        }
      }
      const dailyVisits = labels.map(d => ({ date: d, count: dailyBuckets[d] }));

      let wishlistAdds7d = 0;
      let wishlistAddsPrev7d = 0;
      for (const w of wishAll.data ?? []) {
        if (!w.created_at) continue;
        const t = new Date(w.created_at).getTime();
        if (t >= now - 7 * dayMs) wishlistAdds7d++;
        else if (t >= now - 14 * dayMs) wishlistAddsPrev7d++;
      }

      const nameMap: Record<string, string> = {};
      for (const p of productsAll.data ?? []) nameMap[p.id] = p.name;

      const productClicks = Object.entries(productClickMap)
        .filter(([id]) => nameMap[id])
        .map(([id, clicks]) => ({ id, name: nameMap[id], clicks }))
        .sort((a, b) => b.clicks - a.clicks);

      const wishMap: Record<string, number> = {};
      for (const w of wishAll.data ?? []) wishMap[w.product_id] = (wishMap[w.product_id] || 0) + 1;
      const wishRanks = Object.entries(wishMap)
        .filter(([id]) => nameMap[id])
        .map(([id, wishCount]) => ({ id, name: nameMap[id], wishCount }))
        .sort((a, b) => b.wishCount - a.wishCount);

      setData({
        isLive: true,
        visits7d: analytics7d.count ?? 0,
        newMembers7d: users7d.count ?? 0,
        wishlistAdds7d,
        visitsPrev7d: analyticsPrev7d.count ?? 0,
        newMembersPrev7d: usersPrev7d.count ?? 0,
        wishlistAddsPrev7d,
        activeProducts: productsActive.count ?? 0,
        totalProducts: productsAll.data?.length ?? 0,
        totalMembers: usersAll.count ?? 0,
        totalWishlist: wishAll.data?.length ?? 0,
        totalVisits: analyticsAll.data?.length ?? 0,
        productDetailViews,
        dailyVisits,
        countries: Object.entries(countryMap).map(([country, count]) => ({ country, count })).sort((a, b) => b.count - a.count),
        productClicks,
        wishRanks,
      });
    } catch {
      setData(EMPTY);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => { fetchAll(); }, []);

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

  const todayStr = new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  const start7dStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  const dateRangeLabel = `${start7dStr} – ${todayStr} (최근 7일)`;

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
