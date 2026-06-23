'use client';

import { Users, MousePointerClick, LogOut, FileSearch } from 'lucide-react';
import { StatCard } from '@/components/admin/CafeWidgets';

/**
 * Hero KPI strip for the analyst view. Four cards that together answer
 * "how much, how engaged, how leaky, how deep" — the questions every
 * marketing review starts with.
 */
export default function SessionsKpiStrip({
  sessions,
  engagedSessions,
  bounceRate,
  avgPagesPerSession,
  isLoading,
}: {
  sessions: number;
  engagedSessions: number;
  bounceRate: number;
  avgPagesPerSession: number;
  isLoading: boolean;
}) {
  const engagementRate = sessions ? Math.round((engagedSessions / sessions) * 100) : 0;
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      <StatCard
        accent="#3b82f6"
        label="총 세션"
        value={sessions}
        isLoading={isLoading}
        subLabel="동일 방문자 · 30분 무활동 시 새 세션"
        icon={Users}
      />
      <StatCard
        accent="#22c55e"
        label="참여 세션"
        value={engagedSessions}
        isLoading={isLoading}
        subLabel={`참여율 ${engagementRate}% (페이지 2개 이상)`}
        icon={MousePointerClick}
      />
      <StatCard
        accent="#ef4444"
        label="이탈률"
        value={`${Math.round(bounceRate * 100)}%`}
        isLoading={isLoading}
        subLabel="한 페이지 보고 나간 세션"
        icon={LogOut}
      />
      <StatCard
        accent="#8b5cf6"
        label="세션당 페이지"
        value={avgPagesPerSession.toFixed(1)}
        isLoading={isLoading}
        subLabel="평균 탐색 깊이"
        icon={FileSearch}
      />
    </div>
  );
}
