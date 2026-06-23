'use client';

import { Users, MousePointerClick, LogOut, FileSearch } from 'lucide-react';
import { StatCard } from '@/components/admin/CafeWidgets';

/**
 * Hero KPI strip for the analyst view. Four cards that together answer
 * "how much, how engaged, how leaky, how deep" — the questions every
 * marketing review starts with. Each card carries a % delta versus the
 * same-length prior window so the CEO can read "are we growing?" off
 * the cards directly.
 */

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

export default function SessionsKpiStrip({
  sessions,
  engagedSessions,
  bounceRate,
  avgPagesPerSession,
  prior,
  isLoading,
}: {
  sessions: number;
  engagedSessions: number;
  bounceRate: number;
  avgPagesPerSession: number;
  prior: {
    sessions: number;
    engagedSessions: number;
    bounceRate: number;
    avgPagesPerSession: number;
  };
  isLoading: boolean;
}) {
  const engagementRate = sessions ? Math.round((engagedSessions / sessions) * 100) : 0;
  const sessionsTrend = pctDelta(sessions, prior.sessions);
  const engagedTrend = pctDelta(engagedSessions, prior.engagedSessions);
  // Bounce-rate trend is inverted — a fall in bounce is good; show the
  // delta in percentage POINTS, not %, so the CEO doesn't misread
  // "↓30%" of a 60% bounce rate as "now 42%" when it's actually "now
  // 30 points lower = 30%."
  const bouncePoints = Math.round((bounceRate - prior.bounceRate) * 100);
  const pagesTrend = pctDelta(
    Math.round(avgPagesPerSession * 100),
    Math.round(prior.avgPagesPerSession * 100),
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        accent="#3b82f6"
        label="총 세션"
        value={sessions}
        isLoading={isLoading}
        trend={sessionsTrend}
        trendPeriodLabel="이전 기간 대비"
        subLabel="동일 방문자 · 30분 무활동 시 새 세션"
        icon={Users}
      />
      <StatCard
        accent="#22c55e"
        label="참여 세션"
        value={engagedSessions}
        isLoading={isLoading}
        trend={engagedTrend}
        trendPeriodLabel="이전 기간 대비"
        subLabel={`참여율 ${engagementRate}% (페이지 2개 이상)`}
        icon={MousePointerClick}
      />
      <StatCard
        accent="#ef4444"
        label="이탈률"
        value={`${Math.round(bounceRate * 100)}%`}
        isLoading={isLoading}
        // Inverted: positive bouncePoints means bounce went UP (bad), so
        // pass the *negative* to StatCard's trend so the chip shows red.
        trend={bouncePoints === 0 ? null : -bouncePoints}
        trendPeriodLabel="이전 기간 대비 (낮을수록 좋음)"
        subLabel="한 페이지 보고 나간 세션"
        icon={LogOut}
      />
      <StatCard
        accent="#8b5cf6"
        label="세션당 페이지"
        value={avgPagesPerSession.toFixed(1)}
        isLoading={isLoading}
        trend={pagesTrend}
        trendPeriodLabel="이전 기간 대비"
        subLabel="평균 탐색 깊이"
        icon={FileSearch}
      />
    </div>
  );
}
