'use client';

import {
  RefreshCw, Eye, Heart, Users, Package, Globe, TrendingUp,
  Activity, ShoppingBag,
} from 'lucide-react';
import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { StatCard, Panel, EmptyState, RankBadge } from '@/components/admin/CafeWidgets';

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
 *
 * Top row: 4 stat cards (visits / members / active products / wishlist).
 * Mid: daily visit trend (last 7 days) + visit funnel (visit → product
 * detail → wishlist add) — our analogue of Cafe24's purchase funnel.
 * Bottom: country breakdown + wishlist TOP, product click ranking.
 */

interface DashboardData {
  isLive: boolean;
  // current 7-day window
  visits7d: number;
  newMembers7d: number;
  wishlistAdds7d: number;
  // previous 7-day window — drives trend %
  visitsPrev7d: number;
  newMembersPrev7d: number;
  wishlistAddsPrev7d: number;
  // current totals
  activeProducts: number;
  totalProducts: number;
  totalMembers: number;
  totalWishlist: number;
  totalVisits: number;
  productDetailViews: number;
  // breakdowns
  dailyVisits: { date: string; count: number }[]; // last 7 days, oldest first
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

const COUNTRY_NAMES: Record<string, string> = {
  KR: '한국', US: '미국', JP: '일본', CN: '중국', GB: '영국', DE: '독일',
  FR: '프랑스', SG: '싱가포르', AU: '호주', CA: '캐나다', TH: '태국',
  VN: '베트남', TW: '대만', HK: '홍콩', UNKNOWN: '알 수 없음',
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

      // Daily visit bucketing — last 7 days, ascending so the chart
      // reads left→right as time forward.
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

      // Wishlist windowed counts
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

  const maxDaily = Math.max(...data.dailyVisits.map(d => d.count), 1);
  const todayStr = new Date().toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  const start7dStr = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
  const dateRangeLabel = `${start7dStr} – ${todayStr} (최근 7일)`;

  return (
    <div className="space-y-5">
      {/* Header strip — Cafe24-style live indicator + date range chip + refresh */}
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

      {/* Stat cards row — Cafe24's signature: colored left bar + small
          label + big number + trend chip. Replaces our old icon-tile
          cards. */}
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

      {/* Daily visit trend graph + Visit funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <Panel title="일별 방문 트렌드" subtitle={dateRangeLabel} icon={TrendingUp} className="lg:col-span-2">
          {data.dailyVisits.every(d => d.count === 0) ? (
            <EmptyState label="아직 방문 데이터가 없습니다" />
          ) : (
            <div className="flex items-end gap-2 sm:gap-3 h-44 pt-2">
              {data.dailyVisits.map(d => {
                const h = Math.max(4, Math.round((d.count / maxDaily) * 100));
                const dayLabel = new Date(d.date).toLocaleDateString('ko-KR', { weekday: 'short' });
                const dateNum = new Date(d.date).getDate();
                return (
                  <div key={d.date} className="flex-1 flex flex-col items-center gap-1.5 group">
                    <span className="text-[10px] font-semibold text-[#3b82f6] opacity-0 group-hover:opacity-100 transition-opacity">
                      {d.count}
                    </span>
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full bg-gradient-to-t from-[#3b82f6] to-[#60a5fa] rounded-t transition-all group-hover:from-[#1d4ed8]"
                        style={{ height: `${h}%` }}
                      />
                    </div>
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-semibold text-[#1f2937]">{dateNum}</span>
                      <span className="text-[9px] text-[#9ca3af]">{dayLabel}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="방문 퍼널" subtitle="방문 → 조회 → 찜" icon={ShoppingBag}>
          <div className="space-y-3 pt-1">
            {funnel.map((stage, i) => (
              <div key={stage.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-semibold text-[#374151]">{stage.label}</span>
                  <span className="text-[11px] text-[#6b7280]">
                    <span className="font-bold text-[#1f2937]">{stage.value.toLocaleString()}</span>
                    {i > 0 && <span className="ml-1 text-[#9ca3af]">({stage.pct}%)</span>}
                  </span>
                </div>
                <div className="w-full bg-[#f3f4f6] rounded h-2">
                  <div
                    className="h-2 rounded transition-all"
                    style={{
                      width: `${i === 0 ? 100 : stage.ratio ?? 0}%`,
                      backgroundColor: ['#3b82f6', '#8b5cf6', '#ef4444'][i],
                    }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[10px] text-[#9ca3af] pt-2 border-t border-[#f3f4f6]">
              주문/결제 단계는 KCP 결제 연동 후 추가됩니다.
            </p>
          </div>
        </Panel>
      </div>

      {/* Country + Wishlist row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <Panel title="국가별 방문" subtitle="전체 누적" icon={Globe}>
          {data.countries.length === 0 ? (
            <EmptyState label="아직 방문 데이터가 없습니다" />
          ) : (
            <div className="space-y-2.5">
              {data.countries.slice(0, 8).map(({ country, count }) => {
                const max = data.countries[0]?.count || 1;
                const pct = Math.round((count / max) * 100);
                return (
                  <div key={country}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-[12px] font-medium text-[#374151]">
                        {COUNTRY_NAMES[country] || country}
                      </span>
                      <span className="text-[11px] font-bold text-[#6b7280]">{count.toLocaleString()}회</span>
                    </div>
                    <div className="w-full bg-[#f3f4f6] rounded h-1.5">
                      <div className="bg-[#3b82f6] h-1.5 rounded transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="위시리스트 TOP" subtitle="누적 찜 횟수 기준" icon={Heart}>
          {data.wishRanks.length === 0 ? (
            <EmptyState label="아직 위시리스트 데이터가 없습니다" />
          ) : (
            <div className="space-y-1">
              {data.wishRanks.slice(0, 6).map((item, i) => (
                <div key={item.id} className="flex items-center gap-3 py-2 border-b border-[#f3f4f6] last:border-0">
                  <RankBadge rank={i + 1} />
                  <span className="text-[12px] text-[#1f2937] font-medium truncate flex-1">{item.name}</span>
                  <span className="text-[11px] font-bold text-[#ef4444] flex items-center gap-1">
                    <Heart className="w-3 h-3 fill-current" /> {item.wishCount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Product click ranking */}
      <Panel title="상품 클릭수 TOP" subtitle="상품 상세 페이지 조회수 누적" icon={Eye}>
        {data.productClicks.length === 0 ? (
          <EmptyState label="상품 조회 데이터가 없습니다" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[10px] text-[#9ca3af] font-bold uppercase tracking-wider">
                  <th className="py-2 pl-1 w-10">#</th>
                  <th className="py-2">상품명</th>
                  <th className="py-2 text-right pr-1">클릭수</th>
                  <th className="py-2 pr-2 w-40 sm:w-64">비율</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#f3f4f6]">
                {data.productClicks.slice(0, 10).map((item, i) => {
                  const max = data.productClicks[0]?.clicks || 1;
                  const pct = Math.round((item.clicks / max) * 100);
                  return (
                    <tr key={item.id} className="hover:bg-[#fafbfc] transition-colors">
                      <td className="py-2 pl-1"><RankBadge rank={i + 1} small /></td>
                      <td className="py-2">
                        <Link href="/admin/products" className="text-[12px] font-medium text-[#1f2937] hover:text-[#1f2937] transition-colors">
                          {item.name}
                        </Link>
                      </td>
                      <td className="py-2 text-right pr-1">
                        <span className="text-[12px] font-bold text-[#1f2937]">{item.clicks}</span>
                        <span className="text-[10px] text-[#9ca3af] ml-0.5">회</span>
                      </td>
                      <td className="py-2 pr-2">
                        <div className="w-full bg-[#f3f4f6] rounded h-1.5">
                          <div className="bg-[#f59e0b] h-1.5 rounded" style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* Primitives moved to src/components/admin/CafeWidgets.tsx so other
   admin pages share the same visual language without duplicating
   the markup. */
