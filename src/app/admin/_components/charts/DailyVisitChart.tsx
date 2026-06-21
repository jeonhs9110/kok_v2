'use client';

import { TrendingUp } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';

/**
 * 7-day daily visit bar chart for /admin (dashboard). Each bar's height
 * is normalized to the max bar in the window. Hover reveals the exact
 * count; the date number + 요일 short label always show below the bar.
 */
export default function DailyVisitChart({
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
