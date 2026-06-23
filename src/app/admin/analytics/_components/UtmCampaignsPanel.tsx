'use client';

import { Tag } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';
import type { UtmRow } from './useAnalyticsData';

/**
 * Tagged-campaign performance — one row per (utm_source, utm_medium,
 * utm_campaign) tuple. Empty until the marketing team starts tagging
 * paid links (?utm_source=naver_ads&utm_medium=cpc&utm_campaign=summer).
 * The empty-state copy doubles as documentation so the operator knows
 * what to do to populate the panel.
 */
export default function UtmCampaignsPanel({ utmCampaigns }: { utmCampaigns: UtmRow[] }) {
  const top = utmCampaigns.slice(0, 15);
  return (
    <Panel
      title="캠페인 (UTM 태그)"
      subtitle="?utm_source=… 가 붙은 유입만 집계"
      icon={Tag}
    >
      {top.length === 0 ? (
        <div className="py-8">
          <EmptyState label="태그된 캠페인 유입이 아직 없습니다" />
          <p className="text-[10px] text-[#9ca3af] mt-3 text-center leading-relaxed px-2">
            네이버 광고 / 인스타 광고 링크에{' '}
            <code className="font-mono text-[#374151] bg-[#f3f4f6] px-1 rounded">
              ?utm_source=naver_ads&amp;utm_medium=cpc&amp;utm_campaign=여름특가
            </code>{' '}
            형태로 태그를 붙이면 여기서 광고 성과를 분리해 볼 수 있습니다.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-[#f3f4f6] text-[10px] text-[#9ca3af] font-bold uppercase tracking-wider">
                <th className="py-2">출처</th>
                <th className="py-2">매체</th>
                <th className="py-2">캠페인</th>
                <th className="py-2 text-right">세션</th>
                <th className="py-2 text-right pr-1">상품 조회</th>
              </tr>
            </thead>
            <tbody>
              {top.map((u, i) => (
                <tr key={`${u.source}-${u.medium ?? ''}-${u.campaign ?? ''}-${i}`} className="border-b border-[#f9fafb] last:border-0">
                  <td className="py-2 pr-2 text-[12px] font-medium text-[#1f2937]">{u.source}</td>
                  <td className="py-2 pr-2 text-[11px] text-[#6b7280]">{u.medium ?? '—'}</td>
                  <td className="py-2 pr-2 text-[11px] text-[#6b7280] truncate max-w-[180px]">
                    {u.campaign ?? '—'}
                  </td>
                  <td className="py-2 text-right text-[12px] font-bold text-[#1f2937]">
                    {u.sessions.toLocaleString()}
                  </td>
                  <td className="py-2 text-right pr-1">
                    <span
                      className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                        u.productViewRate >= 0.5
                          ? 'bg-[#dcfce7] text-[#15803d]'
                          : u.productViewRate >= 0.2
                          ? 'bg-[#fef3c7] text-[#92400e]'
                          : 'bg-[#f3f4f6] text-[#6b7280]'
                      }`}
                    >
                      {Math.round(u.productViewRate * 100)}%
                    </span>
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
