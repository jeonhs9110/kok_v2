'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';
import type { KeywordRow } from './useAnalyticsData';
import type { TrafficSource } from '@/lib/analytics/referrer';

/**
 * Top converting keywords — one row per (source, keyword) with the
 * session count and the product-view rate of those sessions. Sort
 * defaults to session volume; the operator can sort by conversion
 * with the toggle. Per-source tabs let them filter to a single engine.
 */
export default function KeywordConversionPanel({
  keywords,
}: {
  keywords: KeywordRow[];
}) {
  const [tab, setTab] = useState<TrafficSource | 'all'>('all');
  const [sortKey, setSortKey] = useState<'sessions' | 'conversion'>('sessions');

  const sourcesInData = useMemo(() => {
    const m = new Map<TrafficSource, string>();
    for (const k of keywords) m.set(k.source, k.sourceLabel);
    return Array.from(m.entries());
  }, [keywords]);

  const filtered = useMemo(() => {
    const base = tab === 'all' ? keywords : keywords.filter(k => k.source === tab);
    const sorted = [...base].sort((a, b) =>
      sortKey === 'sessions' ? b.sessions - a.sessions : b.productViewRate - a.productViewRate,
    );
    return sorted.slice(0, 20);
  }, [keywords, tab, sortKey]);

  return (
    <Panel
      title="무엇을 검색하고 들어왔나"
      subtitle={`상위 ${filtered.length}건 · 검색어 → 상품 조회율`}
      icon={Search}
      action={
        <button
          type="button"
          onClick={() =>
            setSortKey(s => (s === 'sessions' ? 'conversion' : 'sessions'))
          }
          className="text-[10px] font-semibold text-[#6b7280] hover:text-[#1f2937] px-2 py-0.5 border border-[#e5e7eb] rounded"
        >
          정렬: {sortKey === 'sessions' ? '세션 많은 순' : '전환율 높은 순'}
        </button>
      }
    >
      {keywords.length === 0 ? (
        <EmptyState label="기록된 검색 키워드가 없습니다" />
      ) : (
        <>
          <div className="flex items-center gap-1 flex-wrap mb-3">
            <button
              type="button"
              onClick={() => setTab('all')}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition ${
                tab === 'all'
                  ? 'bg-[#1f2937] text-white border-[#1f2937]'
                  : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:bg-[#f9fafb]'
              }`}
            >
              전체
            </button>
            {sourcesInData.map(([source, label]) => (
              <button
                key={source}
                type="button"
                onClick={() => setTab(source)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition ${
                  tab === source
                    ? 'bg-[#1f2937] text-white border-[#1f2937]'
                    : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:bg-[#f9fafb]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-[#f3f4f6] text-[10px] text-[#9ca3af] font-bold uppercase tracking-wider">
                  <th className="py-2">검색어</th>
                  <th className="py-2 text-right">세션</th>
                  <th className="py-2 text-right pr-1">상품 조회율</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((k, i) => (
                  <tr key={`${k.source}-${k.keyword}-${i}`} className="border-b border-[#f9fafb] last:border-0">
                    <td className="py-2 pr-2">
                      <div className="text-[12px] font-medium text-[#1f2937] truncate max-w-[280px]">
                        {k.keyword}
                      </div>
                      <div className="text-[10px] text-[#9ca3af]">{k.sourceLabel}</div>
                    </td>
                    <td className="py-2 text-right text-[12px] font-bold text-[#1f2937]">
                      {k.sessions.toLocaleString()}
                    </td>
                    <td className="py-2 text-right pr-1">
                      <span
                        className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${
                          k.productViewRate >= 0.5
                            ? 'bg-[#dcfce7] text-[#15803d]'
                            : k.productViewRate >= 0.2
                            ? 'bg-[#fef3c7] text-[#92400e]'
                            : 'bg-[#f3f4f6] text-[#6b7280]'
                        }`}
                      >
                        {Math.round(k.productViewRate * 100)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Panel>
  );
}
