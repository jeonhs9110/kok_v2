'use client';

import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';
import type { SearchKeywordRow } from '../useDashboardData';
import type { TrafficSource } from '@/lib/analytics/referrer';

/**
 * 검색 키워드 패널 — surfaces the actual queries visitors typed to
 * land on the store. Pulled from analytics.search_keyword (server-
 * stored on every visit since PR-A) and grouped per source.
 *
 * Notes for the operator on what they're seeing:
 *  - Naver / Daum / Bing / Yahoo / DuckDuckGo expose the full keyword.
 *  - Google encrypts query strings for signed-in users (post-2013) so
 *    most Google rows show no keyword. That's expected, not a bug —
 *    we surface what we receive and don't fabricate a "(not provided)"
 *    placeholder.
 *
 * Tabs let the operator filter to a single source; "전체" shows the
 * mixed leaderboard. Top 20 per view to keep the panel readable.
 */
export default function SearchKeywordsPanel({
  keywords,
}: {
  keywords: SearchKeywordRow[];
}) {
  const sourcesInData = useMemo(() => {
    const seen = new Map<TrafficSource, string>();
    for (const k of keywords) seen.set(k.source, k.sourceLabel);
    return Array.from(seen.entries()).map(([source, label]) => ({ source, label }));
  }, [keywords]);

  const [activeSource, setActiveSource] = useState<TrafficSource | 'all'>('all');

  const filtered = useMemo(
    () =>
      (activeSource === 'all' ? keywords : keywords.filter(k => k.source === activeSource))
        .slice(0, 20),
    [keywords, activeSource],
  );
  const max = filtered[0]?.count ?? 1;
  const totalForFilter = filtered.reduce((s, k) => s + k.count, 0);

  return (
    <Panel
      title="검색 키워드"
      subtitle={`상위 ${filtered.length || 0}건 · 선택 기간`}
      icon={Search}
    >
      {keywords.length === 0 ? (
        <EmptyState label="기록된 검색 키워드가 없습니다" />
      ) : (
        <>
          <div className="flex items-center gap-1 flex-wrap mb-3">
            <button
              type="button"
              onClick={() => setActiveSource('all')}
              className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition ${
                activeSource === 'all'
                  ? 'bg-[#1f2937] text-white border-[#1f2937]'
                  : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:bg-[#f9fafb]'
              }`}
            >
              전체
            </button>
            {sourcesInData.map(({ source, label }) => (
              <button
                key={source}
                type="button"
                onClick={() => setActiveSource(source)}
                className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition ${
                  activeSource === source
                    ? 'bg-[#1f2937] text-white border-[#1f2937]'
                    : 'bg-white text-[#6b7280] border-[#e5e7eb] hover:bg-[#f9fafb]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filtered.map(({ source, sourceLabel, keyword, count }, idx) => {
              const pct = Math.round((count / max) * 100);
              const share = totalForFilter ? Math.round((count / totalForFilter) * 100) : 0;
              return (
                <div key={`${source}-${keyword}-${idx}`}>
                  <div className="flex justify-between items-baseline mb-1 gap-2">
                    <span className="text-[12px] font-medium text-[#374151] truncate">
                      <span className="text-[10px] text-[#9ca3af] mr-1.5">{sourceLabel}</span>
                      {keyword}
                    </span>
                    <span className="text-[11px] font-bold text-[#6b7280] flex-shrink-0">
                      {count.toLocaleString()}회
                      <span className="text-[10px] text-[#9ca3af] font-normal"> · {share}%</span>
                    </span>
                  </div>
                  <div className="w-full bg-[#f3f4f6] rounded h-1.5">
                    <div className="h-1.5 rounded bg-[#3b82f6]" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </Panel>
  );
}
