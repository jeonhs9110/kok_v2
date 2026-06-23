'use client';

import { Compass } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';
import type { ChannelRow } from './useAnalyticsData';
import type { TrafficSource } from '@/lib/analytics/referrer';

const SOURCE_COLOR: Record<TrafficSource, string> = {
  google: '#4285f4', naver: '#03c75a', daum: '#0096ff', bing: '#008373',
  yahoo: '#6001d2', duckduckgo: '#de5833', instagram: '#e4405f',
  facebook: '#1877f2', kakao: '#fee500', twitter: '#000000',
  direct: '#6b7280', other: '#9ca3af',
};

/**
 * Channel mix with conversion quality. Differs from the dashboard's
 * pure-volume panel by surfacing engagement rate + product-view rate
 * inline — so "네이버 = 30회" tells you both how big AND how good.
 *
 * A channel with high sessions but low engagement rate is wasted ad
 * spend; high engagement + low sessions is a quiet winner to scale up.
 */
export default function ChannelMixPanel({ channels }: { channels: ChannelRow[] }) {
  const max = channels[0]?.sessions || 1;
  const total = channels.reduce((s, c) => s + c.sessions, 0);

  return (
    <Panel
      title="어디서 들어왔나"
      subtitle="채널별 세션 · 참여율 · 상품 조회율"
      icon={Compass}
    >
      {channels.length === 0 ? (
        <EmptyState label="아직 분석할 세션이 없습니다" />
      ) : (
        <div className="space-y-3">
          {channels.map(({ source, label, sessions, engagementRate, productViewRate }) => {
            const widthPct = Math.round((sessions / max) * 100);
            const share = total ? Math.round((sessions / total) * 100) : 0;
            return (
              <div key={source}>
                <div className="flex justify-between items-baseline mb-1 gap-2">
                  <span className="text-[12px] font-semibold text-[#1f2937] flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: SOURCE_COLOR[source] }}
                    />
                    {label}
                  </span>
                  <span className="text-[11px] text-[#6b7280] font-bold">
                    {sessions.toLocaleString()}회 · {share}%
                  </span>
                </div>
                <div className="w-full bg-[#f3f4f6] rounded h-1.5 mb-1">
                  <div
                    className="h-1.5 rounded transition-all"
                    style={{ width: `${widthPct}%`, backgroundColor: SOURCE_COLOR[source] }}
                  />
                </div>
                <div className="flex items-center gap-3 text-[10px] text-[#6b7280]">
                  <span>
                    참여율 <span className="font-bold text-[#1f2937]">{Math.round(engagementRate * 100)}%</span>
                  </span>
                  <span className="text-[#d1d5db]">·</span>
                  <span>
                    상품 조회 <span className="font-bold text-[#1f2937]">{Math.round(productViewRate * 100)}%</span>
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
