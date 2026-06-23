'use client';

import { DoorOpen } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';
import type { LandingPageRow } from './useAnalyticsData';

/**
 * Landing-page leaderboard. "Where did the visitor first arrive?" plus
 * the bounce rate and product-view rate of that landing. A page with
 * many sessions and a high bounce rate is the marketing team's "fix
 * this first" target.
 */
export default function LandingPagesPanel({
  landingPages,
}: {
  landingPages: LandingPageRow[];
}) {
  const top = landingPages.slice(0, 10);
  return (
    <Panel
      title="어디로 처음 들어왔나"
      subtitle="랜딩 페이지 · 이탈률 · 상품 조회율"
      icon={DoorOpen}
    >
      {top.length === 0 ? (
        <EmptyState label="아직 분석할 세션이 없습니다" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#f3f4f6] text-[10px] text-[#9ca3af] font-bold uppercase tracking-wider">
                <th className="py-2">페이지</th>
                <th className="py-2 text-right">세션</th>
                <th className="py-2 text-right">이탈률</th>
                <th className="py-2 text-right pr-1">상품 조회</th>
              </tr>
            </thead>
            <tbody>
              {top.map((p, i) => (
                <tr key={`${p.path}-${i}`} className="border-b border-[#f9fafb] last:border-0">
                  <td className="py-2 pr-2">
                    <div className="text-[12px] font-medium text-[#1f2937] truncate max-w-[260px]">
                      {p.label}
                    </div>
                    <div className="text-[10px] text-[#9ca3af] truncate max-w-[260px]">{p.path}</div>
                  </td>
                  <td className="py-2 text-right text-[12px] font-bold text-[#1f2937]">
                    {p.sessions.toLocaleString()}
                  </td>
                  <td className="py-2 text-right">
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                        p.bounceRate >= 0.7
                          ? 'bg-[#fee2e2] text-[#991b1b]'
                          : p.bounceRate >= 0.4
                          ? 'bg-[#fef3c7] text-[#92400e]'
                          : 'bg-[#dcfce7] text-[#15803d]'
                      }`}
                    >
                      {Math.round(p.bounceRate * 100)}%
                    </span>
                  </td>
                  <td className="py-2 text-right pr-1 text-[11px] font-bold text-[#6b7280]">
                    {Math.round(p.productViewRate * 100)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Panel>
  );
}
