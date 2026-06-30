'use client';

import { useEffect, useMemo, useState } from 'react';
import { type TrafficSource } from '@/lib/analytics/referrer';
import {
  rangeFromPreset,
  type DateRange,
  type RangePreset,
} from '../../_components/useDashboardData';

/**
 * Marketing-analytics view — thin client wrapper around
 * /api/admin/analytics. That route runs the sessionizer + every
 * channel/keyword/landing/heatmap roll-up server-side, dispatching to
 * RDS via the standard USE_RDS flag.
 */

export type DeviceType = 'mobile' | 'tablet' | 'desktop';
export type AnalyticsSource = 'rds' | 'supabase' | 'rds_error' | 'supabase_error' | null;

export interface DeviceRow {
  device: DeviceType;
  label: string;
  sessions: number;
  share: number;
  engagementRate: number;
  productViewRate: number;
}

export interface UtmRow {
  source: string;
  medium: string | null;
  campaign: string | null;
  sessions: number;
  productViewRate: number;
}

export interface ChannelRow {
  source: TrafficSource;
  label: string;
  sessions: number;
  engagementRate: number;
  productViewRate: number;
}

export interface KeywordRow {
  source: TrafficSource;
  sourceLabel: string;
  keyword: string;
  sessions: number;
  productViewRate: number;
}

export interface LandingPageRow {
  path: string;
  label: string;
  sessions: number;
  bounceRate: number;
  productViewRate: number;
}

export interface EntryPathRow {
  source: TrafficSource;
  sourceLabel: string;
  keyword: string | null;
  landingPath: string;
  landingLabel: string;
  sessions: number;
  bounceRate: number;
}

export type Heatmap = number[][];

export interface AnalyticsData {
  isLive: boolean;
  pageviews: number;
  pageviewsWithoutIpHash: number;
  sessions: number;
  engagedSessions: number;
  productViewSessions: number;
  bounceRate: number;
  avgPagesPerSession: number;
  sessionsByDay: { date: string; sessions: number }[];
  channels: ChannelRow[];
  keywords: KeywordRow[];
  landingPages: LandingPageRow[];
  entryPaths: EntryPathRow[];
  devices: DeviceRow[];
  utmCampaigns: UtmRow[];
  heatmap: Heatmap;
  peakHour: number | null;
  peakDow: number | null;
  truncated: boolean;
  prior: {
    sessions: number;
    engagedSessions: number;
    bounceRate: number;
    avgPagesPerSession: number;
  };
}

export const EMPTY: AnalyticsData = {
  isLive: false,
  pageviews: 0,
  pageviewsWithoutIpHash: 0,
  sessions: 0,
  engagedSessions: 0,
  productViewSessions: 0,
  bounceRate: 0,
  avgPagesPerSession: 0,
  sessionsByDay: [],
  channels: [],
  keywords: [],
  landingPages: [],
  entryPaths: [],
  devices: [],
  utmCampaigns: [],
  heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
  peakHour: null,
  peakDow: null,
  truncated: false,
  prior: { sessions: 0, engagedSessions: 0, bounceRate: 0, avgPagesPerSession: 0 },
};

export function useAnalyticsData() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset('7d'));
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState<AnalyticsSource>(null);

  async function fetchAll(forRange: DateRange = range) {
    setIsLoading(true);
    try {
      const rangeMs = new Date(forRange.end).getTime() - new Date(forRange.start).getTime();
      const priorStart = new Date(new Date(forRange.start).getTime() - rangeMs).toISOString();
      const priorEnd = forRange.start;

      const params = new URLSearchParams({
        start: forRange.start,
        end: forRange.end,
        priorStart,
        priorEnd,
      });
      const res = await fetch(`/api/admin/analytics?${params}`, { cache: 'no-store' });
      // Guard res.ok before parsing — a 401/403/500 response body might
      // still be JSON (an error envelope), but it never carries the
      // `data` shape this hook expects. Without this check the empty
      // EMPTY skeleton would silently stick around while the operator
      // sees a normal "loaded" UI.
      if (!res.ok) {
        console.error(`[analytics] fetchAll http ${res.status}`);
        return;
      }
      const json = (await res.json()) as { data?: AnalyticsData | null; source?: AnalyticsSource };
      setSource(json.source ?? null);
      if (json.data) setData(json.data);
    } catch (err) {
      console.error('[analytics] fetchAll failed:', err);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    fetchAll(range);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.start, range.end]);

  const presets = useMemo(
    () => ({
      today: rangeFromPreset('today'),
      '7d': rangeFromPreset('7d'),
      '30d': rangeFromPreset('30d'),
      '90d': rangeFromPreset('90d'),
    }),
    [],
  ) as Record<Exclude<RangePreset, 'custom'>, DateRange>;

  return { data, isLoading, range, setRange, presets, source, fetchAll: () => fetchAll(range) };
}
