'use client';

import { Compass } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';
import type { TrafficSource } from '@/lib/analytics/referrer';

/**
 * 유입 경로 (Traffic Source) panel — Cafe24 analytics parity. Shows
 * how visitors arrived, broken down into the 12 buckets the shared
 * categorizeReferrer() recognizes: Google / Naver / Daum / Bing /
 * Yahoo / DuckDuckGo / Instagram / Facebook / Kakao / Twitter /
 * Direct / Other. Categorization happens upstream in useDashboardData
 * (server-stored bucket for fresh rows, referrer fallback for legacy).
 *
 * Each bar is normalized to the leading source so smaller channels
 * remain readable when one dominates (typical: 직접 + 네이버 carry most
 * traffic in the Korean market early on).
 */
const SOURCE_COLOR: Record<TrafficSource, string> = {
  google:     '#4285f4',
  naver:      '#03c75a',
  daum:       '#0096ff',
  bing:       '#008373',
  yahoo:      '#6001d2',
  duckduckgo: '#de5833',
  instagram:  '#e4405f',
  facebook:   '#1877f2',
  kakao:      '#fee500',
  twitter:    '#000000',
  direct:     '#6b7280',
  other:      '#9ca3af',
};

export default function TrafficSourcesPanel({
  sources,
  subtitle = '선택한 기간',
}: {
  sources: { source: TrafficSource; label: string; count: number }[];
  subtitle?: string;
}) {
  const nonZero = sources.filter(s => s.count > 0);
  const max = nonZero[0]?.count || 1;
  const total = nonZero.reduce((s, x) => s + x.count, 0);

  return (
    <Panel title="유입 경로" subtitle={subtitle} icon={Compass}>
      {nonZero.length === 0 ? (
        <EmptyState label="아직 유입 데이터가 없습니다" />
      ) : (
        <div className="space-y-2.5">
          {nonZero.map(({ source, label, count }) => {
            const pct = Math.round((count / max) * 100);
            const share = total ? Math.round((count / total) * 100) : 0;
            return (
              <div key={source}>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-[12px] font-medium text-[#374151] flex items-center gap-1.5">
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: SOURCE_COLOR[source] }}
                    />
                    {label}
                  </span>
                  <span className="text-[11px] font-bold text-[#6b7280]">
                    {count.toLocaleString()}회 <span className="text-[10px] text-[#9ca3af] font-normal">· {share}%</span>
                  </span>
                </div>
                <div className="w-full bg-[#f3f4f6] rounded h-1.5">
                  <div
                    className="h-1.5 rounded transition-all"
                    style={{ width: `${pct}%`, backgroundColor: SOURCE_COLOR[source] }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Panel>
  );
}
