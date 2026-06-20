'use client';

import { TrendingUp, ShoppingBag, Globe, Heart, Eye } from 'lucide-react';
import Link from 'next/link';
import { Panel, EmptyState, RankBadge } from '@/components/admin/CafeWidgets';

const COUNTRY_NAMES: Record<string, string> = {
  KR: '한국', US: '미국', JP: '일본', CN: '중국', GB: '영국', DE: '독일',
  FR: '프랑스', SG: '싱가포르', AU: '호주', CA: '캐나다', TH: '태국',
  VN: '베트남', TW: '대만', HK: '홍콩', UNKNOWN: '알 수 없음',
};

interface FunnelStage {
  label: string;
  value: number;
  pct: number;
  ratio?: number;
}

export function DailyVisitChart({
  dailyVisits,
  dateRangeLabel,
}: {
  dailyVisits: { date: string; count: number }[];
  dateRangeLabel: string;
}) {
  const maxDaily = Math.max(...dailyVisits.map(d => d.count), 1);
  return (
    <Panel title="일별 방문 트렌드" subtitle={dateRangeLabel} icon={TrendingUp} className="lg:col-span-2">
      {dailyVisits.every(d => d.count === 0) ? (
        <EmptyState label="아직 방문 데이터가 없습니다" />
      ) : (
        <div className="flex items-end gap-2 sm:gap-3 h-44 pt-2">
          {dailyVisits.map(d => {
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
  );
}

export function VisitFunnelPanel({ funnel }: { funnel: FunnelStage[] }) {
  return (
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
  );
}

export function CountryBreakdownPanel({ countries }: { countries: { country: string; count: number }[] }) {
  return (
    <Panel title="국가별 방문" subtitle="전체 누적" icon={Globe}>
      {countries.length === 0 ? (
        <EmptyState label="아직 방문 데이터가 없습니다" />
      ) : (
        <div className="space-y-2.5">
          {countries.slice(0, 8).map(({ country, count }) => {
            const max = countries[0]?.count || 1;
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
  );
}

export function WishlistRanksPanel({ wishRanks }: { wishRanks: { id: string; name: string; wishCount: number }[] }) {
  return (
    <Panel title="위시리스트 TOP" subtitle="누적 찜 횟수 기준" icon={Heart}>
      {wishRanks.length === 0 ? (
        <EmptyState label="아직 위시리스트 데이터가 없습니다" />
      ) : (
        <div className="space-y-1">
          {wishRanks.slice(0, 6).map((item, i) => (
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
  );
}

export function ProductClicksTable({ productClicks }: { productClicks: { id: string; name: string; clicks: number }[] }) {
  return (
    <Panel title="상품 클릭수 TOP" subtitle="상품 상세 페이지 조회수 누적" icon={Eye}>
      {productClicks.length === 0 ? (
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
              {productClicks.slice(0, 10).map((item, i) => {
                const max = productClicks[0]?.clicks || 1;
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
  );
}
