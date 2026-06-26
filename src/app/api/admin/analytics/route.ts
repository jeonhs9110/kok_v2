import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth/requireAdmin';
import {
  categorizeReferrer,
  TRAFFIC_SOURCE_LABEL,
  SEARCH_SOURCES,
  type TrafficSource,
} from '@/lib/analytics/referrer';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey) : null;

const SESSION_GAP_MS = 30 * 60 * 1000;
const RAW_LIMIT = 20000;

type DeviceType = 'mobile' | 'tablet' | 'desktop';

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

interface PriorRow {
  path: string | null;
  created_at: string | null;
  ip_hash: string | null;
}

interface Session {
  ipHash: string;
  startMs: number;
  endMs: number;
  pageCount: number;
  trafficSource: TrafficSource;
  landingPath: string;
  searchKeyword: string | null;
  viewedProduct: boolean;
  deviceType: DeviceType;
  utmSource: string | null;
  utmMedium: string | null;
  utmCampaign: string | null;
}

const DEVICE_LABEL: Record<DeviceType, string> = {
  mobile: '모바일',
  tablet: '태블릿',
  desktop: '데스크탑',
};

function isDeviceType(v: string | null): v is DeviceType {
  return v === 'mobile' || v === 'tablet' || v === 'desktop';
}

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

function priorSessionize(rows: PriorRow[]): Session[] {
  return sessionize(
    rows.map(r => ({
      path: r.path,
      referrer: null,
      traffic_source: null,
      search_keyword: null,
      created_at: r.created_at,
      ip_hash: r.ip_hash,
      device_type: null,
      utm_source: null,
      utm_medium: null,
      utm_campaign: null,
    })),
  ).sessions;
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

interface RawData {
  analyticsRange: RawRow[];
  analyticsPrior: PriorRow[];
  productsAll: Array<{ id: string; name: string }>;
}

async function fetchRawFromSupabase(
  rangeStart: string,
  rangeEnd: string,
  priorStart: string,
  priorEnd: string,
): Promise<RawData> {
  if (!supabase) throw new Error('supabase not configured');
  const [analyticsRange, analyticsPrior, productsAll] = await Promise.all([
    supabase
      .from('analytics')
      .select('path, referrer, traffic_source, search_keyword, created_at, ip_hash, device_type, utm_source, utm_medium, utm_campaign')
      .gte('created_at', rangeStart)
      .lt('created_at', rangeEnd)
      .order('created_at', { ascending: false })
      .limit(RAW_LIMIT),
    supabase
      .from('analytics')
      .select('path, created_at, ip_hash')
      .gte('created_at', priorStart)
      .lt('created_at', priorEnd)
      .order('created_at', { ascending: false })
      .limit(RAW_LIMIT),
    supabase.from('products').select('id, name'),
  ]);
  return {
    analyticsRange: (analyticsRange.data ?? []) as RawRow[],
    analyticsPrior: (analyticsPrior.data ?? []) as PriorRow[],
    productsAll: (productsAll.data ?? []) as Array<{ id: string; name: string }>,
  };
}

function aggregate(raw: RawData) {
  const rows = raw.analyticsRange;
  const truncated = rows.length >= RAW_LIMIT;
  const productNames = new Map<string, string>();
  for (const p of raw.productsAll) productNames.set(p.id, p.name);

  const { sessions, skipped } = sessionize(rows);
  const totalSessions = sessions.length;
  const engaged = sessions.filter(s => s.pageCount > 1).length;
  const productView = sessions.filter(s => s.viewedProduct).length;
  const totalPages = sessions.reduce((s, x) => s + x.pageCount, 0);
  const bounceRate = totalSessions ? 1 - engaged / totalSessions : 0;
  const avgPagesPerSession = totalSessions ? totalPages / totalSessions : 0;

  const byDay = new Map<string, number>();
  for (const s of sessions) {
    const day = new Date(s.startMs).toISOString().slice(0, 10);
    byDay.set(day, (byDay.get(day) ?? 0) + 1);
  }
  const sessionsByDay = Array.from(byDay.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, sessionCount]) => ({ date, sessions: sessionCount }));

  const channelMap = new Map<TrafficSource, { sessions: number; engaged: number; product: number }>();
  for (const s of sessions) {
    const e = channelMap.get(s.trafficSource) ?? { sessions: 0, engaged: 0, product: 0 };
    e.sessions++;
    if (s.pageCount > 1) e.engaged++;
    if (s.viewedProduct) e.product++;
    channelMap.set(s.trafficSource, e);
  }
  const channels = Array.from(channelMap.entries())
    .map(([source, v]) => ({
      source,
      label: TRAFFIC_SOURCE_LABEL[source],
      sessions: v.sessions,
      engagementRate: v.sessions ? v.engaged / v.sessions : 0,
      productViewRate: v.sessions ? v.product / v.sessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

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
  const keywords = Array.from(kwMap.values())
    .map(k => ({
      source: k.source,
      sourceLabel: TRAFFIC_SOURCE_LABEL[k.source],
      keyword: k.keyword,
      sessions: k.sessions,
      productViewRate: k.sessions ? k.product / k.sessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const landMap = new Map<string, { sessions: number; bounces: number; product: number }>();
  for (const s of sessions) {
    const e = landMap.get(s.landingPath) ?? { sessions: 0, bounces: 0, product: 0 };
    e.sessions++;
    if (s.pageCount === 1) e.bounces++;
    if (s.viewedProduct) e.product++;
    landMap.set(s.landingPath, e);
  }
  const landingPages = Array.from(landMap.entries())
    .map(([path, v]) => ({
      path,
      label: labelForPath(path, productNames),
      sessions: v.sessions,
      bounceRate: v.sessions ? v.bounces / v.sessions : 0,
      productViewRate: v.sessions ? v.product / v.sessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const entryMap = new Map<string, { source: TrafficSource; keyword: string | null; landingPath: string; sessions: number; bounces: number }>();
  for (const s of sessions) {
    const kw = SEARCH_SOURCES.has(s.trafficSource) && s.searchKeyword && s.searchKeyword !== '(not provided)'
      ? s.searchKeyword
      : null;
    const key = `${s.trafficSource}::${kw ?? ''}::${s.landingPath}`;
    const e = entryMap.get(key) ?? { source: s.trafficSource, keyword: kw, landingPath: s.landingPath, sessions: 0, bounces: 0 };
    e.sessions++;
    if (s.pageCount === 1) e.bounces++;
    entryMap.set(key, e);
  }
  const entryPaths = Array.from(entryMap.values())
    .map(e => ({
      source: e.source,
      sourceLabel: TRAFFIC_SOURCE_LABEL[e.source],
      keyword: e.keyword,
      landingPath: e.landingPath,
      landingLabel: labelForPath(e.landingPath, productNames),
      sessions: e.sessions,
      bounceRate: e.sessions ? e.bounces / e.sessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const deviceMap = new Map<DeviceType, { sessions: number; engaged: number; product: number }>();
  for (const s of sessions) {
    const e = deviceMap.get(s.deviceType) ?? { sessions: 0, engaged: 0, product: 0 };
    e.sessions++;
    if (s.pageCount > 1) e.engaged++;
    if (s.viewedProduct) e.product++;
    deviceMap.set(s.deviceType, e);
  }
  const devices = (['mobile', 'desktop', 'tablet'] as DeviceType[])
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
  const utmCampaigns = Array.from(utmMap.values())
    .map(u => ({
      source: u.source,
      medium: u.medium,
      campaign: u.campaign,
      sessions: u.sessions,
      productViewRate: u.sessions ? u.product / u.sessions : 0,
    }))
    .sort((a, b) => b.sessions - a.sessions);

  const priorSessions = priorSessionize(raw.analyticsPrior);
  const priorTotal = priorSessions.length;
  const priorEngaged = priorSessions.filter(s => s.pageCount > 1).length;
  const priorPages = priorSessions.reduce((s, x) => s + x.pageCount, 0);
  const prior = {
    sessions: priorTotal,
    engagedSessions: priorEngaged,
    bounceRate: priorTotal ? 1 - priorEngaged / priorTotal : 0,
    avgPagesPerSession: priorTotal ? priorPages / priorTotal : 0,
  };

  const heatmap: number[][] = Array.from({ length: 7 }, () => Array.from({ length: 24 }, () => 0));
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

  return {
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
    entryPaths,
    devices,
    utmCampaigns,
    heatmap,
    peakHour,
    peakDow,
    truncated,
    prior,
  };
}

/**
 * GET /api/admin/analytics?start=ISO&end=ISO&priorStart=ISO&priorEnd=ISO
 * Returns the marketing-analytics AnalyticsData shape. Admin-only.
 * Dispatches to RDS when USE_RDS=true.
 */
export async function GET(req: Request) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const url = new URL(req.url);
  const rangeStart = url.searchParams.get('start');
  const rangeEnd = url.searchParams.get('end');
  const priorStart = url.searchParams.get('priorStart');
  const priorEnd = url.searchParams.get('priorEnd');
  if (!rangeStart || !rangeEnd || !priorStart || !priorEnd) {
    return NextResponse.json({ ok: false, error: 'missing range params' }, { status: 400 });
  }

  if (process.env.USE_RDS === 'true') {
    try {
      const { getAnalyticsRawFromPg } = await import('@/lib/db/dashboard-reads');
      const raw = await getAnalyticsRawFromPg(rangeStart, rangeEnd, priorStart, priorEnd);
      const data = aggregate(raw);
      return NextResponse.json({ data, source: 'rds' });
    } catch (err) {
      console.error('[admin/analytics] pg fetch failed:', err);
      return NextResponse.json({ data: null, source: 'rds_error' }, { status: 500 });
    }
  }

  try {
    const raw = await fetchRawFromSupabase(rangeStart, rangeEnd, priorStart, priorEnd);
    const data = aggregate(raw);
    return NextResponse.json({ data, source: 'supabase' });
  } catch (err) {
    console.error('[admin/analytics] supabase fetch failed:', err);
    return NextResponse.json({ data: null, source: 'supabase_error' }, { status: 500 });
  }
}
