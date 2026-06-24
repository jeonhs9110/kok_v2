'use client';

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { AnalyticsData, EntryPathRow } from './useAnalyticsData';
import type { DateRange } from '../../_components/useDashboardData';

/**
 * KOKKOK GARDEN — Marketing Analytics Report PDF.
 *
 * Redesigned 2026-06-24 to read like a consulting / annual report
 * (Deloitte / PwC reference) rather than a stock admin dashboard
 * screenshot. Key shifts:
 *
 *   - Monochrome palette with a single forest-green accent
 *     (#2d5f3f), matching the KOKKOK Garden brand identity.
 *   - Editorial cover — generous whitespace, asymmetric layout,
 *     all-caps small label paired with Korean title.
 *   - Boxed "insight blocks" replaced with horizontal rules + big
 *     numbered statements (01. 02. 03.).
 *   - Hero KPI numbers at 36pt for the four headline metrics, with
 *     trend deltas as a small subscript-style line beneath.
 *   - Tables: no row borders; just an underlined header and
 *     monospaced-feel tabular numbers right-aligned.
 *   - Glossary at the end so the CEO can look up 이탈 / 참여 / 세션
 *     without having to ask.
 *
 * Font: Pretendard Regular + Bold OTF bundled in /public/fonts (no
 * external CDN dependency). The font URL is resolved via new URL()
 * against window.location.origin so react-pdf gets an absolute path
 * regardless of the page's base.
 */

const PRETENDARD_REGULAR = typeof window !== 'undefined'
  ? new URL('/fonts/Pretendard-Regular.otf', window.location.origin).toString()
  : '/fonts/Pretendard-Regular.otf';
const PRETENDARD_BOLD = typeof window !== 'undefined'
  ? new URL('/fonts/Pretendard-Bold.otf', window.location.origin).toString()
  : '/fonts/Pretendard-Bold.otf';

Font.register({
  family: 'Pretendard',
  fonts: [
    { src: PRETENDARD_REGULAR, fontWeight: 400 },
    { src: PRETENDARD_BOLD, fontWeight: 700 },
  ],
});

Font.registerHyphenationCallback(word => [word]);

// Editorial monochrome palette. Single forest-green accent — fits
// the KOKKOK Garden brand and reads as "annual report" rather than
// "AI dashboard with primary colors everywhere."
const COLOR = {
  ink: '#1a1a1a',
  inkSoft: '#333333',
  muted: '#6f6f6f',
  faint: '#b5b5b5',
  rule: '#e3e3e3',
  bg: '#ffffff',
  accent: '#2d5f3f',
  accentSoft: '#5a8a6f',
  pos: '#2d5f3f',
  neg: '#8b2e2e',
  warn: '#a06a1f',
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingBottom: 56,
    paddingHorizontal: 56,
    fontFamily: 'Pretendard',
    fontSize: 9,
    color: COLOR.ink,
    backgroundColor: COLOR.bg,
    lineHeight: 1.5,
  },
  coverPage: {
    paddingTop: 64,
    paddingHorizontal: 64,
    paddingBottom: 64,
    fontFamily: 'Pretendard',
    color: COLOR.ink,
    backgroundColor: COLOR.bg,
  },
  // Editorial cover blocks
  brandMark: {
    fontSize: 9,
    fontWeight: 700,
    letterSpacing: 6,
    color: COLOR.ink,
  },
  coverRule: {
    marginTop: 14,
    marginBottom: 12,
    height: 1,
    backgroundColor: COLOR.ink,
    width: 56,
  },
  coverEyebrow: {
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 3,
    color: COLOR.muted,
    marginTop: 280,
    textTransform: 'uppercase',
  },
  coverTitleKor: {
    fontSize: 34,
    fontWeight: 700,
    color: COLOR.ink,
    marginTop: 6,
    lineHeight: 1.15,
  },
  coverSubtitle: {
    fontSize: 11,
    color: COLOR.muted,
    marginTop: 14,
    lineHeight: 1.55,
    maxWidth: 380,
  },
  coverFootRule: {
    marginTop: 36,
    marginBottom: 14,
    height: 1,
    backgroundColor: COLOR.rule,
  },
  coverFootBlock: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  coverFootLabel: {
    width: 80,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 2,
    color: COLOR.muted,
    textTransform: 'uppercase',
  },
  coverFootValue: {
    fontSize: 10,
    color: COLOR.ink,
  },
  // Section heading — editorial style: small caps eyebrow, large
  // Korean title, hairline rule beneath. No icons (icon clutter is
  // the giveaway look of generated dashboards).
  sectionEyebrow: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 2.5,
    color: COLOR.accent,
    textTransform: 'uppercase',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 700,
    color: COLOR.ink,
    marginTop: 4,
    letterSpacing: -0.4,
  },
  sectionRule: {
    marginTop: 8,
    marginBottom: 14,
    height: 0.7,
    backgroundColor: COLOR.ink,
    width: 28,
  },
  sectionBlock: {
    marginBottom: 22,
  },
  // Hero KPI — big numeric anchor, small label above, delta below.
  kpiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  kpiCol: {
    width: '50%',
    paddingRight: 16,
    paddingBottom: 18,
  },
  kpiLabel: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 2,
    color: COLOR.muted,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  kpiValue: {
    fontSize: 34,
    fontWeight: 700,
    color: COLOR.ink,
    letterSpacing: -1,
    lineHeight: 1.05,
  },
  kpiDelta: {
    fontSize: 8,
    color: COLOR.muted,
    marginTop: 4,
  },
  kpiDeltaPos: {
    fontSize: 8,
    color: COLOR.pos,
    fontWeight: 700,
    marginTop: 4,
  },
  kpiDeltaNeg: {
    fontSize: 8,
    color: COLOR.neg,
    fontWeight: 700,
    marginTop: 4,
  },
  // Numbered insight (cover page summary list)
  insightItem: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.rule,
  },
  insightItemLast: {
    flexDirection: 'row',
    paddingVertical: 8,
  },
  insightNumber: {
    width: 28,
    fontSize: 9,
    fontWeight: 700,
    color: COLOR.accent,
    letterSpacing: 1,
  },
  insightBody: {
    flex: 1,
    fontSize: 10,
    color: COLOR.ink,
    lineHeight: 1.55,
  },
  // Table — no row borders, just an underlined header.
  thead: {
    flexDirection: 'row',
    paddingBottom: 6,
    borderBottomWidth: 0.7,
    borderBottomColor: COLOR.ink,
  },
  th: {
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 1.6,
    color: COLOR.muted,
    textTransform: 'uppercase',
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 6,
    borderBottomWidth: 0.3,
    borderBottomColor: COLOR.rule,
  },
  td: {
    fontSize: 9,
    color: COLOR.ink,
  },
  tdMuted: {
    fontSize: 8,
    color: COLOR.muted,
    marginTop: 1,
  },
  // Channel bar — minimalist rail
  channelRow: {
    marginBottom: 10,
  },
  channelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  channelLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: COLOR.ink,
  },
  channelCount: {
    fontSize: 9,
    color: COLOR.muted,
    fontWeight: 700,
  },
  channelBarTrack: {
    height: 2,
    backgroundColor: COLOR.rule,
  },
  channelMeta: {
    fontSize: 7,
    color: COLOR.muted,
    marginTop: 4,
    letterSpacing: 0.4,
  },
  // Heatmap
  heatmapWrap: {
    flexDirection: 'column',
    gap: 1.5,
  },
  heatRow: {
    flexDirection: 'row',
    gap: 1.5,
    alignItems: 'center',
  },
  heatDayLabel: {
    width: 14,
    fontSize: 7,
    fontWeight: 700,
    color: COLOR.muted,
  },
  heatCell: {
    flex: 1,
    height: 11,
  },
  heatHourRow: {
    flexDirection: 'row',
    gap: 1.5,
    marginBottom: 4,
  },
  heatHourLabel: {
    flex: 1,
    fontSize: 6,
    color: COLOR.faint,
    textAlign: 'center',
  },
  // Recommendation card — minimal, no boxed background
  recBlock: {
    paddingTop: 12,
    paddingBottom: 14,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.rule,
  },
  recHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginBottom: 4,
  },
  recNumber: {
    width: 28,
    fontSize: 9,
    fontWeight: 700,
    color: COLOR.accent,
    letterSpacing: 1,
  },
  recTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: COLOR.ink,
    flex: 1,
    letterSpacing: -0.2,
  },
  recDetail: {
    fontSize: 9,
    color: COLOR.inkSoft,
    lineHeight: 1.6,
    paddingLeft: 28,
  },
  // Glossary
  glossaryRow: {
    flexDirection: 'row',
    paddingVertical: 7,
    borderBottomWidth: 0.5,
    borderBottomColor: COLOR.rule,
  },
  glossaryTerm: {
    width: 96,
    fontSize: 9,
    fontWeight: 700,
    color: COLOR.ink,
  },
  glossaryDef: {
    flex: 1,
    fontSize: 9,
    color: COLOR.inkSoft,
    lineHeight: 1.55,
  },
  // Footer (small caps + pagination)
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: COLOR.rule,
    fontSize: 7,
    color: COLOR.faint,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});

const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

function pct(x: number, digits = 0): string {
  return `${(x * 100).toFixed(digits)}%`;
}

function pctDelta(curr: number, prev: number): number | null {
  if (prev === 0) return curr > 0 ? 100 : null;
  return Math.round(((curr - prev) / prev) * 100);
}

function bounceColor(rate: number): string {
  if (rate >= 0.7) return COLOR.neg;
  if (rate >= 0.4) return COLOR.warn;
  return COLOR.pos;
}

function conversionColor(rate: number): string {
  if (rate >= 0.5) return COLOR.pos;
  if (rate >= 0.2) return COLOR.warn;
  return COLOR.muted;
}

function heatCellColor(value: number, max: number): string {
  if (value === 0) return '#f1f1f1';
  const intensity = value / max;
  // Pre-blend the forest-green accent against a white background so
  // the heatmap output is fully opaque hex (older fontkit chokes on
  // rgba()). Linear interp: out = bg*(1-a) + fg*a.
  const a = 0.18 + intensity * 0.82;
  const r = Math.round(255 * (1 - a) + 0x2d * a);
  const g = Math.round(255 * (1 - a) + 0x5f * a);
  const b = Math.round(255 * (1 - a) + 0x3f * a);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

function deriveInsights(data: AnalyticsData): string[] {
  const out: string[] = [];
  if (data.sessions === 0) return ['선택한 기간에 분석할 세션이 없습니다.'];

  const sessTrend = pctDelta(data.sessions, data.prior.sessions);
  if (sessTrend !== null) {
    const verb = sessTrend > 0 ? '증가' : sessTrend < 0 ? '감소' : '동일';
    out.push(
      `총 세션 ${data.sessions.toLocaleString()}회. 이전 동일 기간 대비 ${Math.abs(sessTrend)}% ${verb}.`,
    );
  } else {
    out.push(`총 세션 ${data.sessions.toLocaleString()}회.`);
  }

  const top = data.channels[0];
  if (top) {
    const share = data.sessions ? top.sessions / data.sessions : 0;
    out.push(
      `주된 유입 채널은 ${top.label}. ${top.sessions.toLocaleString()}회 (전체의 ${pct(share)}), 참여율 ${pct(top.engagementRate)}.`,
    );
  }

  const sortedDevices = [...data.devices].filter(d => d.sessions > 0).sort((a, b) => b.sessions - a.sessions);
  if (sortedDevices.length > 0) {
    const dominant = sortedDevices[0];
    if (dominant.share >= 0.6) {
      out.push(
        `${dominant.label} 사용자가 전체의 ${pct(dominant.share)}로 압도적. ${dominant.label === '모바일' ? '모바일 UX 최적화가 핵심.' : '모바일 유입 캠페인 검토 필요.'}`,
      );
    } else if (sortedDevices.length >= 2) {
      const second = sortedDevices[1];
      out.push(
        `${dominant.label} ${pct(dominant.share)} vs ${second.label} ${pct(second.share)}. 양쪽 모두 신경 써야 함.`,
      );
    }
  }

  const bounceDelta = Math.round((data.bounceRate - data.prior.bounceRate) * 100);
  if (data.bounceRate >= 0.7) {
    out.push(`이탈률 ${pct(data.bounceRate)}로 위험 수준. 랜딩 페이지 카피와 첫 화면 CTA 점검 필요.`);
  } else if (bounceDelta !== 0 && data.prior.sessions > 0) {
    const direction = bounceDelta < 0 ? '개선' : '악화';
    out.push(`이탈률 ${pct(data.bounceRate)}. 이전 기간 대비 ${Math.abs(bounceDelta)} 포인트 ${direction}.`);
  } else {
    out.push(`이탈률 ${pct(data.bounceRate)}. 참여율 ${pct(data.engagedSessions / data.sessions)}.`);
  }

  if (data.peakDow !== null && data.peakHour !== null) {
    out.push(
      `유입 피크는 ${DAY_LABELS[data.peakDow]}요일 ${data.peakHour}시 (KST). SNS 포스팅·이메일 발송 타이밍을 맞춰볼 것.`,
    );
  }

  const topKw = data.keywords[0];
  if (topKw) {
    out.push(
      `상위 검색어 "${topKw.keyword}" (${topKw.sourceLabel}, ${topKw.sessions}회). 관련 콘텐츠/SEO 강화 여지.`,
    );
  }

  return out;
}

function deriveRecommendations(data: AnalyticsData): { title: string; detail: string }[] {
  const recs: { title: string; detail: string }[] = [];
  if (data.sessions === 0) return [];

  const worstLanding = data.landingPages.find(p => p.sessions >= 3 && p.bounceRate >= 0.7);
  if (worstLanding) {
    recs.push({
      title: `${worstLanding.label} 이탈 개선`,
      detail: `${worstLanding.label} (${worstLanding.path}) 이탈률 ${pct(worstLanding.bounceRate)}. ${worstLanding.sessions.toLocaleString()}회 중 대부분이 첫 페이지만 보고 나갔습니다. 첫 화면 카피·이미지·CTA를 우선 점검하세요.`,
    });
  }

  if (data.utmCampaigns.length === 0) {
    recs.push({
      title: '광고 링크 UTM 태깅 시작',
      detail: 'utm_source 태그가 붙은 유입이 없습니다. 광고 링크에 ?utm_source=…&utm_medium=…&utm_campaign=…을 붙여야 광고 효과를 분리해 측정할 수 있습니다.',
    });
  }

  const mobile = data.devices.find(d => d.device === 'mobile');
  if (mobile && mobile.share >= 0.7) {
    recs.push({
      title: '모바일 UX 우선 투자',
      detail: `모바일 사용자가 전체의 ${pct(mobile.share)}로 절대 다수입니다. 디자인·QA·성능 최적화 예산을 모바일 기준으로 우선 배정하시기를 권합니다.`,
    });
  }

  if (data.channels.length >= 2) {
    const top = data.channels[0];
    const topShare = data.sessions ? top.sessions / data.sessions : 0;
    if (topShare >= 0.7) {
      recs.push({
        title: '유입 다양화 검토',
        detail: `${top.label} 한 채널이 전체 ${pct(topShare)}를 차지합니다. 해당 채널의 알고리즘 변경이나 정책 변동에 취약합니다. 보조 채널(인스타·카카오·SEO 등) 발굴이 필요합니다.`,
      });
    }
  }

  if (data.peakDow !== null && data.peakHour !== null) {
    recs.push({
      title: '피크 시간대 활용',
      detail: `${DAY_LABELS[data.peakDow]}요일 ${data.peakHour}시(KST) 전후가 유입 피크입니다. 이 시간대에 맞춰 인스타그램 포스트, 카카오 알림톡, 신상품 공개를 배치하면 노출 대비 클릭률을 끌어올릴 수 있습니다.`,
    });
  }

  const lowQuality = data.channels.find(c => c.sessions >= 5 && c.productViewRate < 0.1);
  if (lowQuality) {
    recs.push({
      title: `${lowQuality.label} 유입 품질 점검`,
      detail: `${lowQuality.label}에서 ${lowQuality.sessions.toLocaleString()}회 유입이 있지만 상품 페이지 도달율이 ${pct(lowQuality.productViewRate)}로 낮습니다. 랜딩 페이지 메시지와 광고 카피의 매칭이 안 되어 있을 가능성이 있습니다.`,
    });
  }

  return recs.slice(0, 5);
}

function executiveSentence(data: AnalyticsData): string {
  if (data.sessions === 0) return '선택한 기간에 분석할 세션이 없습니다.';
  const topChannel = data.channels[0];
  const channelPart = topChannel
    ? `최대 유입 채널은 ${topChannel.label} (전체의 ${pct(topChannel.sessions / data.sessions)})`
    : '';
  const bouncePart = `이탈률 ${pct(data.bounceRate)}`;
  const engagedPart = `참여율 ${pct(data.engagedSessions / data.sessions)}`;
  return [channelPart, engagedPart, bouncePart].filter(Boolean).join(' · ') + '.';
}

function describeEntry(e: EntryPathRow): string {
  if (e.keyword) return `${e.sourceLabel} 검색 "${e.keyword}"`;
  if (e.source === 'direct') return '직접 방문 (URL 입력 / 즐겨찾기 / 앱)';
  return `${e.sourceLabel}에서 유입`;
}

function DeltaText({ value, isInverted = false }: { value: number | null; isInverted?: boolean }) {
  if (value === null) return <Text style={styles.kpiDelta}>전 기간 대비 —</Text>;
  if (value === 0) return <Text style={styles.kpiDelta}>전 기간과 동일</Text>;
  const isGood = isInverted ? value < 0 : value > 0;
  const style = isGood ? styles.kpiDeltaPos : styles.kpiDeltaNeg;
  const arrow = value > 0 ? '▲' : '▼';
  return (
    <Text style={style}>
      {arrow} {Math.abs(value)}% 전 기간 대비
    </Text>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <View>
      <Text style={styles.sectionEyebrow}>{eyebrow}</Text>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionRule} />
    </View>
  );
}

function Footer({ pageLabel, generatedAt }: { pageLabel: string; generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>KOKKOK GARDEN · MARKETING ANALYTICS</Text>
      <Text>{generatedAt} KST</Text>
      <Text>{pageLabel}</Text>
    </View>
  );
}

export default function AnalyticsReportPdf({
  data,
  range,
  generatedAt,
}: {
  data: AnalyticsData;
  range: DateRange;
  generatedAt: string;
}) {
  const sessionsTrend = pctDelta(data.sessions, data.prior.sessions);
  const engagedTrend = pctDelta(data.engagedSessions, data.prior.engagedSessions);
  const bouncePoints = Math.round((data.bounceRate - data.prior.bounceRate) * 100);
  const pagesTrend = pctDelta(
    Math.round(data.avgPagesPerSession * 100),
    Math.round(data.prior.avgPagesPerSession * 100),
  );

  let heatMax = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (data.heatmap[d][h] > heatMax) heatMax = data.heatmap[d][h];
    }
  }

  const topChannels = data.channels.slice(0, 8);
  const topKeywords = data.keywords.slice(0, 10);
  const topLandings = data.landingPages.slice(0, 10);
  const topUtm = data.utmCampaigns.slice(0, 10);
  const topEntryPaths = data.entryPaths.slice(0, 12);
  const activeDevices = data.devices.filter(d => d.sessions > 0);

  const insights = deriveInsights(data);
  const recommendations = deriveRecommendations(data);

  const sparkBars = data.sessionsByDay.slice(-30);
  const sparkMax = Math.max(1, ...sparkBars.map(b => b.sessions));

  // Hour-of-day distribution collapsed across all 7 days. The CEO
  // wanted concrete numbers per hour with a timezone (KST), not just
  // the heatmap.
  const hourTotals = Array.from({ length: 24 }, (_, h) => {
    let n = 0;
    for (let d = 0; d < 7; d++) n += data.heatmap[d][h];
    return { hour: h, count: n };
  });
  const totalHourSessions = hourTotals.reduce((s, x) => s + x.count, 0);
  const timeBands = [
    { label: '새벽 (00–06시)', from: 0, to: 6 },
    { label: '오전 (06–12시)', from: 6, to: 12 },
    { label: '오후 (12–18시)', from: 12, to: 18 },
    { label: '저녁 (18–24시)', from: 18, to: 24 },
  ].map(b => {
    let n = 0;
    for (let h = b.from; h < b.to; h++) n += hourTotals[h].count;
    return { ...b, sessions: n, share: totalHourSessions ? n / totalHourSessions : 0 };
  });
  const topHours = [...hourTotals]
    .filter(h => h.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  return (
    <Document
      title={`KOKKOK GARDEN — 마케팅 분석 리포트 (${range.label})`}
      author="KOKKOK GARDEN"
    >
      {/* ===== Cover ===== */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.brandMark}>KOKKOK GARDEN</Text>
        <View style={styles.coverRule} />

        <Text style={styles.coverEyebrow}>Marketing Analytics Report</Text>
        <Text style={styles.coverTitleKor}>마케팅 분석{'\n'}리포트</Text>
        <Text style={styles.coverSubtitle}>
          {executiveSentence(data)}
        </Text>

        <View style={styles.coverFootRule} />
        <View style={styles.coverFootBlock}>
          <Text style={styles.coverFootLabel}>Period</Text>
          <Text style={styles.coverFootValue}>{range.label}</Text>
        </View>
        <View style={styles.coverFootBlock}>
          <Text style={styles.coverFootLabel}>Generated</Text>
          <Text style={styles.coverFootValue}>{generatedAt} (한국 표준시 KST, UTC+9)</Text>
        </View>
        <View style={styles.coverFootBlock}>
          <Text style={styles.coverFootLabel}>Author</Text>
          <Text style={styles.coverFootValue}>KOKKOK GARDEN 운영팀</Text>
        </View>

        <Footer pageLabel="COVER" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 2: Executive summary (insights) ===== */}
      <Page size="A4" style={styles.page}>
        <SectionHeading eyebrow="Executive Summary" title="주요 인사이트" />

        {insights.map((line, i) => (
          <View
            key={i}
            style={i === insights.length - 1 ? styles.insightItemLast : styles.insightItem}
          >
            <Text style={styles.insightNumber}>{String(i + 1).padStart(2, '0')}.</Text>
            <Text style={styles.insightBody}>{line}</Text>
          </View>
        ))}

        <Footer pageLabel="02" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 3: Performance — KPI hero + sessions trend ===== */}
      <Page size="A4" style={styles.page}>
        <SectionHeading eyebrow="Performance" title="핵심 지표" />

        <View style={styles.kpiRow}>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>총 세션</Text>
            <Text style={styles.kpiValue}>{data.sessions.toLocaleString()}</Text>
            <DeltaText value={sessionsTrend} />
          </View>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>참여 세션</Text>
            <Text style={styles.kpiValue}>{data.engagedSessions.toLocaleString()}</Text>
            <DeltaText value={engagedTrend} />
          </View>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>이탈률</Text>
            <Text style={styles.kpiValue}>{pct(data.bounceRate)}</Text>
            <DeltaText value={bouncePoints === 0 ? null : -bouncePoints} isInverted />
          </View>
          <View style={styles.kpiCol}>
            <Text style={styles.kpiLabel}>세션당 페이지</Text>
            <Text style={styles.kpiValue}>{data.avgPagesPerSession.toFixed(1)}</Text>
            <DeltaText value={pagesTrend} />
          </View>
        </View>

        {sparkBars.length > 0 && (
          <View style={[styles.sectionBlock, { marginTop: 10 }]}>
            <Text style={styles.kpiLabel}>최근 {sparkBars.length}일 세션 추이</Text>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 64, gap: 2, marginTop: 8 }}>
              {sparkBars.map(b => {
                const h = Math.max(2, Math.round((b.sessions / sparkMax) * 100));
                return (
                  <View
                    key={b.date}
                    style={{ flex: 1, height: `${h}%`, backgroundColor: COLOR.accent }}
                  />
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 }}>
              <Text style={{ fontSize: 7, color: COLOR.faint }}>
                {sparkBars[0]?.date.slice(5)}
              </Text>
              <Text style={{ fontSize: 7, color: COLOR.faint }}>
                {sparkBars[sparkBars.length - 1]?.date.slice(5)}
              </Text>
            </View>
          </View>
        )}

        <Footer pageLabel="03" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 4: Acquisition — channels + devices ===== */}
      <Page size="A4" style={styles.page}>
        <SectionHeading eyebrow="Acquisition" title="어디서 들어왔나" />

        {topChannels.length === 0 ? (
          <Text style={[styles.tdMuted, { paddingVertical: 16 }]}>
            아직 분석할 채널 데이터가 없습니다
          </Text>
        ) : (
          topChannels.map(c => {
            const max = topChannels[0].sessions || 1;
            const widthPct = Math.max(2, Math.round((c.sessions / max) * 100));
            const share = data.sessions ? c.sessions / data.sessions : 0;
            return (
              <View key={c.source} style={styles.channelRow}>
                <View style={styles.channelHead}>
                  <Text style={styles.channelLabel}>{c.label}</Text>
                  <Text style={styles.channelCount}>
                    {c.sessions.toLocaleString()}회 · {pct(share)}
                  </Text>
                </View>
                <View style={styles.channelBarTrack}>
                  <View style={{ height: 2, backgroundColor: COLOR.accent, width: `${widthPct}%` }} />
                </View>
                <Text style={styles.channelMeta}>
                  참여율 {pct(c.engagementRate)} · 상품 조회 {pct(c.productViewRate)}
                </Text>
              </View>
            );
          })
        )}

        <View style={styles.sectionBlock} />
        <SectionHeading eyebrow="Device" title="기기" />

        {activeDevices.length === 0 ? (
          <Text style={styles.tdMuted}>아직 분석할 기기 데이터가 없습니다</Text>
        ) : (
          <View>
            <View style={styles.thead}>
              <Text style={[styles.th, { flex: 1.4 }]}>기기</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>세션</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>비중</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>참여율</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>상품 조회율</Text>
            </View>
            {activeDevices.map(d => (
              <View key={d.device} style={styles.tr}>
                <Text style={[styles.td, { flex: 1.4, fontWeight: 700 }]}>{d.label}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                  {d.sessions.toLocaleString()}
                </Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{pct(d.share)}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                  {pct(d.engagementRate)}
                </Text>
                <Text style={[styles.td, { flex: 1.2, textAlign: 'right' }]}>
                  {pct(d.productViewRate)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Footer pageLabel="04" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 5: Entry-path detail — the "how exactly they came in" story ===== */}
      <Page size="A4" style={styles.page}>
        <SectionHeading
          eyebrow="Entry Detail"
          title="어떻게 정확히 들어왔나"
        />
        <Text style={{ fontSize: 9, color: COLOR.muted, marginBottom: 14, lineHeight: 1.5 }}>
          각 행은 [유입 채널 + 검색어(있을 경우) + 첫 페이지] 조합입니다.
          여러 사람이 같은 경로로 들어왔으면 한 줄로 묶입니다.
        </Text>

        {topEntryPaths.length === 0 ? (
          <Text style={[styles.tdMuted, { paddingVertical: 16 }]}>
            아직 분석할 유입 경로가 없습니다
          </Text>
        ) : (
          <View>
            <View style={styles.thead}>
              <Text style={[styles.th, { flex: 3.5 }]}>경로</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>세션</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>이탈률</Text>
            </View>
            {topEntryPaths.map((e, i) => (
              <View key={`${e.source}-${e.keyword ?? ''}-${e.landingPath}-${i}`} style={styles.tr}>
                <View style={{ flex: 3.5 }}>
                  <Text style={styles.td}>
                    {describeEntry(e)} → {e.landingLabel}
                  </Text>
                  <Text style={styles.tdMuted}>{e.landingPath}</Text>
                </View>
                <Text style={[styles.td, { flex: 1, textAlign: 'right', fontWeight: 700 }]}>
                  {e.sessions.toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.td,
                    { flex: 1, textAlign: 'right', color: bounceColor(e.bounceRate), fontWeight: 700 },
                  ]}
                >
                  {pct(e.bounceRate)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Footer pageLabel="05" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 6: Search keywords + UTM campaigns ===== */}
      <Page size="A4" style={styles.page}>
        <SectionHeading
          eyebrow="Search"
          title="무엇을 검색하고 들어왔나"
        />

        {topKeywords.length === 0 ? (
          <Text style={[styles.tdMuted, { paddingVertical: 16 }]}>
            아직 기록된 검색 키워드가 없습니다 — 네이버 / 다음 등 검색 엔진으로
            유입이 생기면 자동 누적됩니다
          </Text>
        ) : (
          <View>
            <View style={styles.thead}>
              <Text style={[styles.th, { flex: 3 }]}>검색어 / 출처</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>세션</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>상품 조회율</Text>
            </View>
            {topKeywords.map((k, i) => (
              <View key={`${k.source}-${k.keyword}-${i}`} style={styles.tr}>
                <View style={{ flex: 3 }}>
                  <Text style={styles.td}>{k.keyword}</Text>
                  <Text style={styles.tdMuted}>{k.sourceLabel}</Text>
                </View>
                <Text style={[styles.td, { flex: 1, textAlign: 'right', fontWeight: 700 }]}>
                  {k.sessions.toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.td,
                    { flex: 1.2, textAlign: 'right', color: conversionColor(k.productViewRate), fontWeight: 700 },
                  ]}
                >
                  {pct(k.productViewRate)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <View style={styles.sectionBlock} />
        <SectionHeading eyebrow="Paid Traffic" title="태그된 캠페인 (UTM)" />

        {topUtm.length === 0 ? (
          <Text style={{ fontSize: 9, color: COLOR.muted, lineHeight: 1.6 }}>
            아직 태그된 캠페인 유입이 없습니다. 광고 링크에{' '}
            <Text style={{ fontWeight: 700, color: COLOR.ink }}>
              ?utm_source=naver_ads&utm_medium=cpc&utm_campaign=여름특가
            </Text>{' '}
            형태로 태그를 붙이면 같은 referrer라도 광고 클릭만 분리해서 측정할 수 있습니다.
          </Text>
        ) : (
          <View>
            <View style={styles.thead}>
              <Text style={[styles.th, { flex: 1.5 }]}>출처</Text>
              <Text style={[styles.th, { flex: 1 }]}>매체</Text>
              <Text style={[styles.th, { flex: 2 }]}>캠페인</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>세션</Text>
              <Text style={[styles.th, { flex: 1.2, textAlign: 'right' }]}>상품 조회율</Text>
            </View>
            {topUtm.map((u, i) => (
              <View key={`utm-${i}`} style={styles.tr}>
                <Text style={[styles.td, { flex: 1.5, fontWeight: 700 }]}>{u.source}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{u.medium ?? '—'}</Text>
                <Text style={[styles.td, { flex: 2 }]}>{u.campaign ?? '—'}</Text>
                <Text style={[styles.td, { flex: 1, textAlign: 'right', fontWeight: 700 }]}>
                  {u.sessions.toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.td,
                    { flex: 1.2, textAlign: 'right', color: conversionColor(u.productViewRate), fontWeight: 700 },
                  ]}
                >
                  {pct(u.productViewRate)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Footer pageLabel="06" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 7: Landing pages ===== */}
      <Page size="A4" style={styles.page}>
        <SectionHeading eyebrow="Landing" title="어디로 처음 들어왔나" />

        {topLandings.length === 0 ? (
          <Text style={[styles.tdMuted, { paddingVertical: 16 }]}>
            아직 랜딩 페이지 데이터가 없습니다
          </Text>
        ) : (
          <View>
            <View style={styles.thead}>
              <Text style={[styles.th, { flex: 3 }]}>페이지</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>세션</Text>
              <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>이탈률</Text>
              <Text style={[styles.th, { flex: 1.1, textAlign: 'right' }]}>상품 조회</Text>
            </View>
            {topLandings.map((p, i) => (
              <View key={`${p.path}-${i}`} style={styles.tr}>
                <View style={{ flex: 3 }}>
                  <Text style={styles.td}>{p.label}</Text>
                  <Text style={styles.tdMuted}>{p.path}</Text>
                </View>
                <Text style={[styles.td, { flex: 1, textAlign: 'right', fontWeight: 700 }]}>
                  {p.sessions.toLocaleString()}
                </Text>
                <Text
                  style={[
                    styles.td,
                    { flex: 1, textAlign: 'right', color: bounceColor(p.bounceRate), fontWeight: 700 },
                  ]}
                >
                  {pct(p.bounceRate)}
                </Text>
                <Text
                  style={[
                    styles.td,
                    { flex: 1.1, textAlign: 'right', color: conversionColor(p.productViewRate), fontWeight: 700 },
                  ]}
                >
                  {pct(p.productViewRate)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Footer pageLabel="07" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 8: When — time-of-day detail in KST ===== */}
      <Page size="A4" style={styles.page}>
        <SectionHeading eyebrow="Timing" title="언제 들어오나" />
        <Text style={{ fontSize: 9, color: COLOR.muted, marginBottom: 12, lineHeight: 1.5 }}>
          모든 시간은 한국 표준시(KST, UTC+9) 기준입니다.
          {data.peakDow !== null && data.peakHour !== null &&
            ` 유입 피크: ${DAY_LABELS[data.peakDow]}요일 ${data.peakHour}시.`}
        </Text>

        <Text style={[styles.kpiLabel, { marginTop: 6 }]}>시간대별 분포</Text>
        <View style={{ marginTop: 8, marginBottom: 18 }}>
          <View style={styles.thead}>
            <Text style={[styles.th, { flex: 2.5 }]}>시간대 (KST)</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>세션</Text>
            <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>비중</Text>
          </View>
          {timeBands.map(b => (
            <View key={b.label} style={styles.tr}>
              <Text style={[styles.td, { flex: 2.5, fontWeight: 700 }]}>{b.label}</Text>
              <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{b.sessions.toLocaleString()}</Text>
              <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>{pct(b.share)}</Text>
            </View>
          ))}
        </View>

        {topHours.length > 0 && (
          <View style={{ marginBottom: 18 }}>
            <Text style={styles.kpiLabel}>상위 피크 시간</Text>
            <View style={{ marginTop: 8 }}>
              <View style={styles.thead}>
                <Text style={[styles.th, { flex: 2 }]}>시각 (KST)</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>세션</Text>
                <Text style={[styles.th, { flex: 1, textAlign: 'right' }]}>비중</Text>
              </View>
              {topHours.map(h => (
                <View key={h.hour} style={styles.tr}>
                  <Text style={[styles.td, { flex: 2, fontWeight: 700 }]}>
                    {String(h.hour).padStart(2, '0')}:00 – {String((h.hour + 1) % 24).padStart(2, '0')}:00
                  </Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                    {h.count.toLocaleString()}
                  </Text>
                  <Text style={[styles.td, { flex: 1, textAlign: 'right' }]}>
                    {totalHourSessions ? pct(h.count / totalHourSessions) : '—'}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}

        <Text style={styles.kpiLabel}>요일 × 시간대 (KST)</Text>
        {heatMax === 0 ? (
          <Text style={[styles.tdMuted, { paddingVertical: 12 }]}>
            아직 분석할 세션이 없습니다
          </Text>
        ) : (
          <View style={{ marginTop: 10 }}>
            <View style={styles.heatHourRow}>
              <View style={{ width: 14 }} />
              {Array.from({ length: 24 }, (_, h) => (
                <Text key={`hh-${h}`} style={styles.heatHourLabel}>
                  {h % 3 === 0 ? h : ''}
                </Text>
              ))}
            </View>
            <View style={styles.heatmapWrap}>
              {DAY_LABELS.map((day, dow) => (
                <View key={`dr-${dow}`} style={styles.heatRow}>
                  <Text style={styles.heatDayLabel}>{day}</Text>
                  {Array.from({ length: 24 }, (_, h) => (
                    <View
                      key={`${dow}-${h}`}
                      style={[
                        styles.heatCell,
                        { backgroundColor: heatCellColor(data.heatmap[dow][h], heatMax) },
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        )}

        <Footer pageLabel="08" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 9: Recommendations + glossary ===== */}
      <Page size="A4" style={styles.page}>
        <SectionHeading eyebrow="Next Steps" title="추천 액션" />

        {recommendations.length === 0 ? (
          <Text style={[styles.tdMuted, { paddingVertical: 20 }]}>
            현재 지표에서 즉시 권장할 액션이 없습니다. 다음 보고 주기에 다시 확인해주세요.
          </Text>
        ) : (
          recommendations.map((r, i) => (
            <View key={i} style={styles.recBlock}>
              <View style={styles.recHead}>
                <Text style={styles.recNumber}>{String(i + 1).padStart(2, '0')}.</Text>
                <Text style={styles.recTitle}>{r.title}</Text>
              </View>
              <Text style={styles.recDetail}>{r.detail}</Text>
            </View>
          ))
        )}

        <View style={{ height: 24 }} />
        <SectionHeading eyebrow="Glossary" title="용어 설명" />
        <View style={styles.glossaryRow}>
          <Text style={styles.glossaryTerm}>세션</Text>
          <Text style={styles.glossaryDef}>
            동일 방문자(같은 IP 해시)의 활동 묶음. 30분 이상 무활동이면 다음 활동은 새 세션으로 셉니다.
          </Text>
        </View>
        <View style={styles.glossaryRow}>
          <Text style={styles.glossaryTerm}>이탈</Text>
          <Text style={styles.glossaryDef}>
            한 세션 안에서 단 한 페이지만 보고 사이트를 떠난 경우. 처음 도착한 페이지에서 다른
            페이지로 넘어가지 않았다면 이탈입니다.
          </Text>
        </View>
        <View style={styles.glossaryRow}>
          <Text style={styles.glossaryTerm}>이탈률</Text>
          <Text style={styles.glossaryDef}>
            전체 세션 중 이탈로 끝난 세션의 비율. 낮을수록 좋습니다 (사이트가 다음 페이지로 끌어들이고 있다는 뜻).
          </Text>
        </View>
        <View style={styles.glossaryRow}>
          <Text style={styles.glossaryTerm}>참여 세션</Text>
          <Text style={styles.glossaryDef}>
            2페이지 이상을 본 세션. 이탈의 반대 개념입니다.
          </Text>
        </View>
        <View style={styles.glossaryRow}>
          <Text style={styles.glossaryTerm}>참여율</Text>
          <Text style={styles.glossaryDef}>
            전체 세션 중 참여 세션의 비율. 높을수록 좋습니다.
          </Text>
        </View>
        <View style={styles.glossaryRow}>
          <Text style={styles.glossaryTerm}>상품 조회율</Text>
          <Text style={styles.glossaryDef}>
            전체 세션 중 상품 상세 페이지(/products/X)를 한 번이라도 본 세션의 비율. 구매
            의도의 약한 신호로 해석합니다.
          </Text>
        </View>
        <View style={styles.glossaryRow}>
          <Text style={styles.glossaryTerm}>피크 시간</Text>
          <Text style={styles.glossaryDef}>
            요일 × 시간대 중 세션이 가장 많이 시작된 1시간 구간 (KST 기준).
          </Text>
        </View>

        <View style={{ height: 18 }} />
        <Text style={{ fontSize: 8, color: COLOR.muted, lineHeight: 1.7 }}>
          본 리포트는 KOKKOK GARDEN 자체 분석 시스템에서 자동 생성됩니다. 세션은 동일 방문자의
          30분 무활동을 기준으로 묶이며, 채널 · 캠페인 · 기기 분류는 각 세션 첫 페이지의
          referrer / utm_source / user-agent에서 도출합니다.
          {data.pageviewsWithoutIpHash > 0 &&
            ` 구버전 로그 ${data.pageviewsWithoutIpHash.toLocaleString()}건은 방문자 식별 데이터가 없어 세션 분석에서 제외되었습니다.`}
        </Text>

        <Footer pageLabel="09" generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}
