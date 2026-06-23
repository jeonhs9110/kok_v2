'use client';

import { useEffect, useMemo, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import {
  categorizeReferrer,
  TRAFFIC_SOURCE_LABEL,
  SEARCH_SOURCES,
  type TrafficSource,
} from '@/lib/analytics/referrer';
import {
  rangeFromPreset,
  type DateRange,
  type RangePreset,
} from '../../_components/useDashboardData';

const supabase = getSupabaseBrowser();

/**
 * Marketing-analytics view — the "where did they come from, what did
 * they do" page. Everything here is built on a SESSION abstraction
 * derived client-side from the analytics table:
 *
 *   session = a run of pageviews from the same ip_hash with no >30min
 *             gap between consecutive events.
 *
 * The first row in a session decides the session's traffic_source +
 * landing_path + search_keyword. Pages-per-session, bounce rate, and
 * engagement rate all fall out of this construction.
 *
 * Rows without an ip_hash (pre-migration-41 history) are dropped from
 * the sessionizer — there's no way to know which of those rows
 * belong together. The dashboard's "분석 가능한 세션" badge surfaces
 * the gap so the operator knows the analyst view ignores some history.
 */

/** Session-gap threshold. 30 min is the GA/Cafe24 industry default. */
const SESSION_GAP_MS = 30 * 60 * 1000;
const RAW_LIMIT = 20000;

export type DeviceType = 'mobile' | 'tablet' | 'desktop';

export interface Session {
  ipHash: string;
  startMs: number;
  endMs: number;
  pageCount: number;
  trafficSource: TrafficSource;
  landingPath: string;
  searchKeyword: string | null;
  /** True if any page in this session was a product detail (/products/X). */
  viewedProduct: boolean;
  deviceType: DeviceType;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

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
  /** Share of the channel's sessions that engaged (>1 pageview). */
  engagementRate: number;
  /** Share of the channel's sessions that viewed a product detail page. */
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

/** 7 × 24 heatmap. heatmap[day][hour] = session-start count. */
export type Heatmap = number[][];

export interface AnalyticsData {
  isLive: boolean;
  /** Pageview rows analyzed (before sessionization). */
  pageviews: number;
  /** Pageview rows without ip_hash, excluded from sessionization. */
  pageviewsWithoutIpHash: number;
  sessions: number;
  engagedSessions: number;
  productViewSessions: number;
  bounceRate: number;
  avgPagesPerSession: number;
  /** Day-keyed session-start counts for the trend chart. */
  sessionsByDay: { date: string; sessions: number }[];
  channels: ChannelRow[];
  keywords: KeywordRow[];
  landingPages: LandingPageRow[];
  devices: DeviceRow[];
  utmCampaigns: UtmRow[];
  heatmap: Heatmap;
  /** Peak hour-of-day across the range (0-23 KST). */
  peakHour: number | null;
  /** Peak day-of-week (0=Sun..6=Sat). */
  peakDow: number | null;
  truncated: boolean;
  /** Counts in the immediately-prior same-length window for trend %. */
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
  devices: [],
  utmCampaigns: [],
  heatmap: Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0)),
  peakHour: null,
  peakDow: null,
  truncated: false,
  prior: { sessions: 0, engagedSessions: 0, bounceRate: 0, avgPagesPerSession: 0 },
};

interface RawRow {
  path: string | null;
  referrer: string | null;
  traffic_source: string | null;
  search_keyword: string | null;
  created_at: string | null;
  ip_hash: string | null;
  device_type: string | null;
  utm_source: string | null;
  utm_medium: string | null;
  utm_campaign: string | null;
}

const DEVICE_LABEL: Record<DeviceType, string> = {
  mobile: '모바일',
  tablet: '태블릿',
  desktop: '데스크탑',
};

function isDeviceType(v: string | null): v is DeviceType {
  return v === 'mobile' || v === 'tablet' || v === 'desktop';
}

/**
 * Turn raw pageview rows into sessions. Rows must arrive newest-first
 * (the query orders desc) — we re-sort per ip_hash to walk forward in
 * time and detect 30-min gaps cleanly.
 */
function sessionize(rows: RawRow[]): { sessions: Session[]; skipped: number } {
  const byIp = new Map<string, RawRow[]>();
  let skipped = 0;
  for (const r of rows) {
    if (!r.ip_hash || !r.created_at) {
      skipped++;
      continue;
    }
    const arr = byIp.get(r.ip_hash);
    if (arr) arr.push(r);
    else byIp.set(r.ip_hash, [r]);
  }
  const sessions: Session[] = [];
  for (const [ipHash, group] of byIp.entries()) {
    group.sort((a, b) => +new Date(a.created_at!) - +new Date(b.created_at!));
    let current: Session | null = null;
    for (const row of group) {
      const t = +new Date(row.created_at!);
      const path = row.path || '/';
      const isProductDetail = /\/products\/[^/]+$/.test(path);
      if (!current || t - current.endMs > SESSION_GAP_MS) {
        if (current) sessions.push(current);
        const src = (row.traffic_source as TrafficSource | null) ?? categorizeReferrer(row.referrer);
        const dev = isDeviceType(row.device_type) ? row.device_type : 'desktop';
        current = {
          ipHash,
          startMs: t,
          endMs: t,
          pageCount: 1,
          trafficSource: src,
          landingPath: path,
          searchKeyword: row.search_keyword,
          viewedProduct: isProductDetail,
          deviceType: dev,
          utmSource: row.utm_source,
          utmMedium: row.utm_medium,
          utmCampaign: row.utm_campaign,
        };
      } else {
        current.endMs = t;
        current.pageCount += 1;
        if (isProductDetail) current.viewedProduct = true;
      }
    }
    if (current) sessions.push(current);
  }
  return { sessions, skipped };
}

function labelForPath(path: string, productNames: Map<string, string>): string {
  if (path === '/' || path === '/kr' || path === '/global') return '홈';
  const productMatch = path.match(/\/products\/([^/]+)$/);
  if (productMatch) {
    const name = productNames.get(productMatch[1]);
    return name ? `상품 - ${name}` : `상품 상세`;
  }
  if (path.endsWith('/products')) return '상품 목록';
  if (path.includes('/categories/')) return '카테고리';
  if (path.includes('/menus/')) return path.split('/menus/')[1];
  return path;
}

export function useAnalyticsData() {
  const [range, setRange] = useState<DateRange>(() => rangeFromPreset('7d'));
  const [data, setData] = useState<AnalyticsData>(EMPTY);
  const [isLoading, setIsLoading] = useState(true);

  async function fetchAll(forRange: DateRange = range) {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('No client');

      const rangeMs = new Date(forRange.end).getTime() - new Date(forRange.start).getTime();
      const priorStart = new Date(new Date(forRange.start).getTime() - rangeMs).toISOString();
      const priorEnd = forRange.start;

      const [analyticsRange, analyticsPrior, productsAll] = await Promise.all([
        supabase
          .from('analytics')
          .select('path, referrer, traffic_source, search_keyword, created_at, ip_hash, device_type, utm_source, utm_medium, utm_campaign')
          .gte('created_at', forRange.start)
          .lt('created_at', forRange.end)
          .order('created_at', { ascending: false })
          .limit(RAW_LIMIT),
        // Prior window — only need ip_hash + path + created_at to derive
        // session count, engaged %, bounce % for the trend deltas. We
        // skip the heavy referrer/keyword columns to keep the fetch lean.
        supabase
          .from('analytics')
          .select('path, created_at, ip_hash')
          .gte('created_at', priorStart)
          .lt('created_at', priorEnd)
          .order('created_at', { ascending: false })
          .limit(RAW_LIMIT),
        supabase.from('products').select('id, name'),
      ]);

      const rows = (analyticsRange.data ?? []) as RawRow[];
      const truncated = rows.length >= RAW_LIMIT;
      const productNames = new Map<string, string>();
      for (const p of productsAll.data ?? []) productNames.set(p.id, p.name);

      const { sessions, skipped } = sessionize(rows);
      const totalSessions = sessions.length;
      const engaged = sessions.filter(s => s.pageCount > 1).length;
      const productView = sessions.filter(s => s.viewedProduct).length;
      const totalPages = sessions.reduce((s, x) => s + x.pageCount, 0);
      const bounceRate = totalSessions ? 1 - engaged / totalSessions : 0;
      const avgPagesPerSession = totalSessions ? totalPages / totalSessions : 0;

      // Daily session-start trend — bucket by the day the session started.
      const byDay = new Map<string, number>();
      for (const s of sessions) {
        const day = new Date(s.startMs).toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }
      const sessionsByDay = Array.from(byDay.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, sessions]) => ({ date, sessions }));

      // Channel mix — per source: sessions + engagement + product-view rate.
      const channelMap = new Map<TrafficSource, { sessions: number; engaged: number; product: number }>();
      for (const s of sessions) {
        const e = channelMap.get(s.trafficSource) ?? { sessions: 0, engaged: 0, product: 0 };
        e.sessions++;
        if (s.pageCount > 1) e.engaged++;
        if (s.viewedProduct) e.product++;
        channelMap.set(s.trafficSource, e);
      }
      const channels: ChannelRow[] = Array.from(channelMap.entries())
        .map(([source, v]) => ({
          source,
          label: TRAFFIC_SOURCE_LABEL[source],
          sessions: v.sessions,
          engagementRate: v.sessions ? v.engaged / v.sessions : 0,
          productViewRate: v.sessions ? v.product / v.sessions : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions);

      // Keyword conversion — group sessions with a search keyword by
      // (source, keyword), compute product-view rate per row. The
      // panel ranks by sessions first; conversion rate is the
      // secondary read.
      const kwMap = new Map<string, { source: TrafficSource; keyword: string; sessions: number; product: number }>();
      for (const s of sessions) {
        if (!SEARCH_SOURCES.has(s.trafficSource)) continue;
        const kw = s.searchKeyword;
        if (!kw || !kw.trim() || kw === '(not provided)') continue;
        const key = `${s.trafficSource}::${kw}`;
        const e = kwMap.get(key) ?? { source: s.trafficSource, keyword: kw, sessions: 0, product: 0 };
        e.sessions++;
        if (s.viewedProduct) e.product++;
        kwMap.set(key, e);
      }
      const keywords: KeywordRow[] = Array.from(kwMap.values())
        .map(k => ({
          source: k.source,
          sourceLabel: TRAFFIC_SOURCE_LABEL[k.source],
          keyword: k.keyword,
          sessions: k.sessions,
          productViewRate: k.sessions ? k.product / k.sessions : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions);

      // Landing pages — per session, where did they arrive? Bounce rate
      // here mirrors GA's definition: of sessions that landed on this
      // path, how many saw only that one page?
      const landMap = new Map<string, { sessions: number; bounces: number; product: number }>();
      for (const s of sessions) {
        const e = landMap.get(s.landingPath) ?? { sessions: 0, bounces: 0, product: 0 };
        e.sessions++;
        if (s.pageCount === 1) e.bounces++;
        if (s.viewedProduct) e.product++;
        landMap.set(s.landingPath, e);
      }
      const landingPages: LandingPageRow[] = Array.from(landMap.entries())
        .map(([path, v]) => ({
          path,
          label: labelForPath(path, productNames),
          sessions: v.sessions,
          bounceRate: v.sessions ? v.bounces / v.sessions : 0,
          productViewRate: v.sessions ? v.product / v.sessions : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions);

      // Device split — mobile / tablet / desktop. The CEO question
      // ("how many are mobile?") needs a top-level breakdown, plus
      // engagement and product-view rates so the operator can see
      // whether the new mobile carousel is actually moving the
      // mobile-specific funnel.
      const deviceMap = new Map<DeviceType, { sessions: number; engaged: number; product: number }>();
      for (const s of sessions) {
        const e = deviceMap.get(s.deviceType) ?? { sessions: 0, engaged: 0, product: 0 };
        e.sessions++;
        if (s.pageCount > 1) e.engaged++;
        if (s.viewedProduct) e.product++;
        deviceMap.set(s.deviceType, e);
      }
      const devices: DeviceRow[] = (['mobile', 'desktop', 'tablet'] as DeviceType[])
        .map(device => {
          const v = deviceMap.get(device) ?? { sessions: 0, engaged: 0, product: 0 };
          return {
            device,
            label: DEVICE_LABEL[device],
            sessions: v.sessions,
            share: totalSessions ? v.sessions / totalSessions : 0,
            engagementRate: v.sessions ? v.engaged / v.sessions : 0,
            productViewRate: v.sessions ? v.product / v.sessions : 0,
          };
        });

      // UTM campaign mix — only sessions whose landing URL carried a
      // utm_source tag. Empty when nothing's tagged; surfaces 어 organic
      // vs paid (or "campaign A" vs "campaign B") quality side by side
      // once the marketing team starts running tagged links.
      const utmMap = new Map<string, { source: string; medium: string | null; campaign: string | null; sessions: number; product: number }>();
      for (const s of sessions) {
        if (!s.utmSource) continue;
        const key = `${s.utmSource}::${s.utmMedium ?? ''}::${s.utmCampaign ?? ''}`;
        const e = utmMap.get(key) ?? {
          source: s.utmSource,
          medium: s.utmMedium,
          campaign: s.utmCampaign,
          sessions: 0,
          product: 0,
        };
        e.sessions++;
        if (s.viewedProduct) e.product++;
        utmMap.set(key, e);
      }
      const utmCampaigns: UtmRow[] = Array.from(utmMap.values())
        .map(u => ({
          source: u.source,
          medium: u.medium,
          campaign: u.campaign,
          sessions: u.sessions,
          productViewRate: u.sessions ? u.product / u.sessions : 0,
        }))
        .sort((a, b) => b.sessions - a.sessions);

      // Prior same-length window — just enough fields to compute trend
      // deltas on the four KPI-strip metrics. We sessionize the prior
      // rows the same way and read out the four numbers we need.
      const priorRows = (analyticsPrior.data ?? []) as RawRow[];
      const { sessions: priorSessions } = sessionize(priorRows);
      const priorTotal = priorSessions.length;
      const priorEngaged = priorSessions.filter(s => s.pageCount > 1).length;
      const priorPages = priorSessions.reduce((s, x) => s + x.pageCount, 0);
      const prior = {
        sessions: priorTotal,
        engagedSessions: priorEngaged,
        bounceRate: priorTotal ? 1 - priorEngaged / priorTotal : 0,
        avgPagesPerSession: priorTotal ? priorPages / priorTotal : 0,
      };

      // Hour-of-day × day-of-week heatmap. Hours are in browser-local
      // time, which is KST for the operator — matches when they'd post
      // on Instagram or run a campaign.
      const heatmap: Heatmap = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
      for (const s of sessions) {
        const d = new Date(s.startMs);
        heatmap[d.getDay()][d.getHours()]++;
      }
      let peakHour: number | null = null;
      let peakDow: number | null = null;
      let peakValue = 0;
      for (let dow = 0; dow < 7; dow++) {
        for (let h = 0; h < 24; h++) {
          if (heatmap[dow][h] > peakValue) {
            peakValue = heatmap[dow][h];
            peakHour = h;
            peakDow = dow;
          }
        }
      }

      setData({
        isLive: true,
        pageviews: rows.length,
        pageviewsWithoutIpHash: skipped,
        sessions: totalSessions,
        engagedSessions: engaged,
        productViewSessions: productView,
        bounceRate,
        avgPagesPerSession,
        sessionsByDay,
        channels,
        keywords,
        landingPages,
        devices,
        utmCampaigns,
        heatmap,
        peakHour,
        peakDow,
        truncated,
        prior,
      });
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

  return { data, isLoading, range, setRange, presets, fetchAll: () => fetchAll(range) };
}
