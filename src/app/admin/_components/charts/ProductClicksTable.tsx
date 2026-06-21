'use client';

import { Eye } from 'lucide-react';
import Link from 'next/link';
import { Panel, EmptyState, RankBadge } from '@/components/admin/CafeWidgets';

/**
 * Top-10 product clicks table — clicks derived from analytics paths
 * matching `/products/<id>`. The "ratio" bar uses #f59e0b so it visually
 * distinguishes from the funnel + country charts (both use #3b82f6).
 * Product name links to /admin/products (we don't have a per-product
 * detail page yet — the modal there owns edit).
 */
export default function ProductClicksTable({
  productClicks,
}: {
  productClicks: { id: string; name: string; clicks: number }[];
}) {
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
