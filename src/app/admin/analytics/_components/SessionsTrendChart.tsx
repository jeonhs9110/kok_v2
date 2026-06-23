'use client';

import { TrendingUp } from 'lucide-react';
import { Panel, EmptyState } from '@/components/admin/CafeWidgets';

/**
 * Sessions-per-day line/bar chart for the selected range. Uses a
 * simple SVG sparkline + day labels so it stays readable in a single
 * narrow panel. No tooltip lib — the bar's title attribute is enough
 * for an analyst view (the heatmap below carries the time-of-day
 * detail).
 */
export default function SessionsTrendChart({
  sessionsByDay,
}: {
  sessionsByDay: { date: string; sessions: number }[];
}) {
  const trimmed = sessionsByDay.slice(-30);
  const max = Math.max(1, ...trimmed.map(d => d.sessions));

  return (
    <Panel title="세션 추이" subtitle="선택 기간 일별" icon={TrendingUp}>
      {trimmed.length === 0 ? (
        <EmptyState label="아직 분석할 세션이 없습니다" />
      ) : (
        <div>
          <div className="flex items-end gap-1 h-32">
            {trimmed.map(d => {
              const h = Math.max(2, Math.round((d.sessions / max) * 100));
              return (
                <div
                  key={d.date}
                  title={`${d.date} · ${d.sessions}세션`}
                  className="flex-1 bg-[#3b82f6] rounded-t transition-all hover:bg-[#2563eb]"
                  style={{ height: `${h}%` }}
                />
              );
            })}
          </div>
          <div className="flex justify-between text-[10px] text-[#9ca3af] mt-2">
            <span>{trimmed[0]?.date.slice(5)}</span>
            <span>{trimmed[trimmed.length - 1]?.date.slice(5)}</span>
          </div>
        </div>
      )}
    </Panel>
  );
}
