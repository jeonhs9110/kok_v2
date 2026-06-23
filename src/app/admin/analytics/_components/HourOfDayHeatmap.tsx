'use client';

import { Clock } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';
import type { Heatmap } from './useAnalyticsData';

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/**
 * 시간대 × 요일 heatmap of session starts. Answers the marketer's
 * "when should I post on Instagram or run an ad?" question — the
 * darkest cells are when the audience is already on the site.
 *
 * Saturation scales linearly with the cell value relative to the
 * panel's max so a single hot hour doesn't crush every other cell to
 * invisible. Hours are in browser-local time, which is KST for the
 * operator (same timezone the boss + admin operator work in).
 */
export default function HourOfDayHeatmap({
  heatmap,
  peakHour,
  peakDow,
}: {
  heatmap: Heatmap;
  peakHour: number | null;
  peakDow: number | null;
}) {
  let max = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (heatmap[d][h] > max) max = heatmap[d][h];
    }
  }
  const peakLabel =
    peakHour !== null && peakDow !== null
      ? `피크: ${DAY_LABELS[peakDow]}요일 ${peakHour}시`
      : null;

  return (
    <Panel
      title="언제 들어오나"
      subtitle={peakLabel ?? '요일 × 시간대 세션 시작'}
      icon={Clock}
    >
      {max === 0 ? (
        <EmptyState label="아직 분석할 세션이 없습니다" />
      ) : (
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="grid gap-0.5" style={{ gridTemplateColumns: '20px repeat(24, minmax(14px, 1fr))' }}>
              <div />
              {Array.from({ length: 24 }, (_, h) => (
                <div
                  key={`h-${h}`}
                  className="text-[9px] text-[#9ca3af] text-center font-bold"
                >
                  {h % 3 === 0 ? h : ''}
                </div>
              ))}
              {DAY_LABELS.map((day, dow) => (
                <div key={`row-${dow}`} className="contents">
                  <div className="text-[10px] text-[#6b7280] font-bold flex items-center">
                    {day}
                  </div>
                  {Array.from({ length: 24 }, (_, h) => {
                    const value = heatmap[dow][h];
                    const intensity = value / max;
                    const isPeak = dow === peakDow && h === peakHour;
                    return (
                      <div
                        key={`${dow}-${h}`}
                        title={`${day}요일 ${h}시 · ${value}회`}
                        className={`h-4 rounded-sm ${isPeak ? 'ring-1 ring-[#1f2937]' : ''}`}
                        style={{
                          backgroundColor:
                            value === 0
                              ? '#f3f4f6'
                              : `rgba(59, 130, 246, ${0.15 + intensity * 0.85})`,
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center justify-end gap-2 mt-3 text-[10px] text-[#9ca3af]">
              <span>적음</span>
              <div className="flex gap-0.5">
                {[0.15, 0.35, 0.55, 0.75, 1].map(a => (
                  <div
                    key={a}
                    className="w-4 h-2.5 rounded-sm"
                    style={{ backgroundColor: `rgba(59, 130, 246, ${a})` }}
                  />
                ))}
              </div>
              <span>많음</span>
            </div>
          </div>
        </div>
      )}
    </Panel>
  );
}
