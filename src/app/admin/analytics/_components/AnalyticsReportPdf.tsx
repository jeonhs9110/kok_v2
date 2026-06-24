'use client';

import { Document, Page, Text, View, StyleSheet, Font } from '@react-pdf/renderer';
import type { AnalyticsData } from './useAnalyticsData';
import type { DateRange } from '../../_components/useDashboardData';

/**
 * Coded PDF report for the marketing analytics page.
 *
 * NOT a window.print() screenshot — every element here is a native
 * react-pdf primitive (Document / Page / Text / View) so the output
 * is a real vector PDF with searchable text, clean tables, and a
 * proper cover page. Window.print() couldn't deliver any of those:
 * the boss's first export came back as a half-page screenshot fragment
 * (PDF reviewed 2026-06-24) — this replaces that approach end to end.
 *
 * Font strategy: Noto Sans KR registered from jsDelivr (CORS-permissive
 * CDN, stable URL) so Korean glyphs render natively. Default Helvetica
 * fallback is wired so the file isn't blank if the font fetch fails
 * — but the report's Korean text is the primary content, so the
 * register call runs at module load.
 */

// Pretendard OTF via jsDelivr — chosen over WOFF2 because fontkit (the
// font-parsing layer underneath @react-pdf/renderer) doesn't reliably
// decode brotli-compressed WOFF2 in the browser; the v1 of this report
// loaded the .subset.woff2 build and crashed PDF generation at click
// time. OTF passes through fontkit's parser natively.
const PRETENDARD_REGULAR = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/Pretendard-Regular.otf';
const PRETENDARD_BOLD = 'https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/packages/pretendard/dist/web/static/Pretendard-Bold.otf';

Font.register({
  family: 'Pretendard',
  fonts: [
    { src: PRETENDARD_REGULAR, fontWeight: 400 },
    { src: PRETENDARD_BOLD, fontWeight: 700 },
  ],
});

// Hyphenation off — Korean has no hyphens, and react-pdf's default
// English hyphenator garbles mixed Korean+ASCII strings (URLs, product
// IDs) by inserting soft breaks mid-token.
Font.registerHyphenationCallback(word => [word]);

const COLOR = {
  ink: '#111111',
  muted: '#6b7280',
  faint: '#9ca3af',
  ruler: '#e5e7eb',
  panelBg: '#fafafa',
  brand: '#1f2937',
  accent: '#3b82f6',
  good: '#16a34a',
  bad: '#dc2626',
  warn: '#d97706',
} as const;

const styles = StyleSheet.create({
  page: {
    paddingTop: 36,
    paddingBottom: 44,
    paddingHorizontal: 36,
    fontFamily: 'Pretendard',
    fontSize: 9,
    color: COLOR.ink,
    backgroundColor: '#ffffff',
  },
  // Cover page
  coverPage: {
    paddingTop: 80,
    paddingHorizontal: 56,
    paddingBottom: 56,
    fontFamily: 'Pretendard',
    color: COLOR.ink,
    backgroundColor: '#ffffff',
  },
  coverBrand: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: 6,
    color: COLOR.muted,
    marginBottom: 8,
  },
  coverTitle: {
    fontSize: 38,
    fontWeight: 700,
    color: COLOR.brand,
    lineHeight: 1.1,
    marginBottom: 24,
  },
  coverSubtitle: {
    fontSize: 13,
    color: COLOR.muted,
    marginBottom: 56,
  },
  coverMeta: {
    borderTopWidth: 1,
    borderTopColor: COLOR.ruler,
    paddingTop: 16,
    marginTop: 24,
  },
  coverMetaRow: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  coverMetaLabel: {
    width: 96,
    fontSize: 9,
    fontWeight: 700,
    color: COLOR.muted,
  },
  coverMetaValue: {
    fontSize: 10,
    color: COLOR.ink,
  },
  // Section heading
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    color: COLOR.brand,
    marginBottom: 2,
  },
  sectionSubtitle: {
    fontSize: 9,
    color: COLOR.muted,
    marginBottom: 8,
  },
  sectionBlock: {
    marginBottom: 18,
  },
  // KPI strip
  kpiRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 8,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: COLOR.panelBg,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.accent,
  },
  kpiLabel: {
    fontSize: 8,
    color: COLOR.muted,
    fontWeight: 700,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  kpiValue: {
    fontSize: 18,
    fontWeight: 700,
    color: COLOR.ink,
    marginTop: 2,
  },
  kpiSub: {
    fontSize: 8,
    color: COLOR.faint,
    marginTop: 2,
  },
  kpiTrendUp: {
    fontSize: 8,
    color: COLOR.good,
    fontWeight: 700,
    marginTop: 2,
  },
  kpiTrendDown: {
    fontSize: 8,
    color: COLOR.bad,
    fontWeight: 700,
    marginTop: 2,
  },
  // Table
  table: {
    borderTopWidth: 1,
    borderTopColor: COLOR.ruler,
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: COLOR.panelBg,
    paddingVertical: 6,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.ruler,
  },
  th: {
    fontSize: 7,
    fontWeight: 700,
    color: COLOR.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  tr: {
    flexDirection: 'row',
    paddingVertical: 5,
    paddingHorizontal: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLOR.ruler,
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
  badgeGood: {
    fontSize: 8,
    fontWeight: 700,
    color: COLOR.good,
  },
  badgeWarn: {
    fontSize: 8,
    fontWeight: 700,
    color: COLOR.warn,
  },
  badgeBad: {
    fontSize: 8,
    fontWeight: 700,
    color: COLOR.bad,
  },
  // Footer
  footer: {
    position: 'absolute',
    bottom: 18,
    left: 36,
    right: 36,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: COLOR.ruler,
    paddingTop: 8,
    fontSize: 7,
    color: COLOR.faint,
  },
  // Channel bar
  channelRow: {
    marginBottom: 7,
  },
  channelHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  channelLabel: {
    fontSize: 9,
    fontWeight: 700,
    color: COLOR.ink,
  },
  channelCount: {
    fontSize: 8,
    color: COLOR.muted,
    fontWeight: 700,
  },
  channelBarTrack: {
    height: 4,
    backgroundColor: COLOR.ruler,
    borderRadius: 2,
  },
  channelMeta: {
    fontSize: 7,
    color: COLOR.muted,
    marginTop: 2,
  },
  // Heatmap
  heatmapWrap: {
    flexDirection: 'column',
    gap: 1,
  },
  heatRow: {
    flexDirection: 'row',
    gap: 1,
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
    height: 10,
    borderRadius: 1,
  },
  heatHourRow: {
    flexDirection: 'row',
    gap: 1,
    marginBottom: 2,
  },
  heatHourLabel: {
    flex: 1,
    fontSize: 6,
    color: COLOR.faint,
    textAlign: 'center',
  },
  // Insight block
  insightBlock: {
    backgroundColor: COLOR.panelBg,
    borderLeftWidth: 3,
    borderLeftColor: COLOR.accent,
    paddingVertical: 10,
    paddingHorizontal: 12,
    marginBottom: 10,
    borderRadius: 4,
  },
  insightLabel: {
    fontSize: 8,
    fontWeight: 700,
    color: COLOR.muted,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  insightText: {
    fontSize: 10,
    color: COLOR.ink,
    lineHeight: 1.5,
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
  if (rate >= 0.7) return COLOR.bad;
  if (rate >= 0.4) return COLOR.warn;
  return COLOR.good;
}

function conversionColor(rate: number): string {
  if (rate >= 0.5) return COLOR.good;
  if (rate >= 0.2) return COLOR.warn;
  return COLOR.muted;
}

function heatCellColor(value: number, max: number): string {
  if (value === 0) return '#f3f4f6';
  const intensity = value / max;
  // Pre-blend translucent #3b82f6 against a white background so we
  // emit a fully opaque hex color — older fontkit versions inside
  // @react-pdf/renderer choke on rgba() at the color parser. Linear
  // blend: out = bg*(1-a) + fg*a, with bg=255 (white) for each channel.
  const a = 0.15 + intensity * 0.85;
  const r = Math.round(255 * (1 - a) + 0x3b * a);
  const g = Math.round(255 * (1 - a) + 0x82 * a);
  const b = Math.round(255 * (1 - a) + 0xf6 * a);
  const hex = (n: number) => n.toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * Build a single executive-summary line for the cover page. Distills
 * the numbers into the sentence a CEO would actually read: who's
 * winning, where's the leak.
 */
function executiveSentence(data: AnalyticsData): string {
  if (data.sessions === 0) return '선택한 기간에 분석할 세션이 없습니다.';
  const topChannel = data.channels[0];
  const channelPart = topChannel
    ? `최대 유입 채널은 ${topChannel.label}(${topChannel.sessions.toLocaleString()}회 · 전체의 ${pct(
        topChannel.sessions / data.sessions,
      )})`
    : '';
  const bouncePart = `이탈률 ${pct(data.bounceRate)}`;
  const engagedPart = `참여율 ${pct(data.engagedSessions / data.sessions)}`;
  return [channelPart, engagedPart, bouncePart].filter(Boolean).join(' · ') + '.';
}

function TrendLabel({ value }: { value: number | null }) {
  if (value === null) return <Text style={styles.kpiSub}>이전 기간 대비 —</Text>;
  if (value === 0) return <Text style={styles.kpiSub}>이전 기간과 동일</Text>;
  const isUp = value > 0;
  return (
    <Text style={isUp ? styles.kpiTrendUp : styles.kpiTrendDown}>
      {isUp ? '▲' : '▼'} {Math.abs(value)}% (이전 기간 대비)
    </Text>
  );
}

function SectionHeading({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <View>
      <Text style={styles.sectionTitle}>{title}</Text>
      {subtitle && <Text style={styles.sectionSubtitle}>{subtitle}</Text>}
    </View>
  );
}

function Footer({ pageLabel, generatedAt }: { pageLabel: string; generatedAt: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>KOKKOK GARDEN · 마케팅 분석 리포트</Text>
      <Text>{generatedAt}</Text>
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

  // Heatmap normalization
  let heatMax = 0;
  for (let d = 0; d < 7; d++) {
    for (let h = 0; h < 24; h++) {
      if (data.heatmap[d][h] > heatMax) heatMax = data.heatmap[d][h];
    }
  }

  // Trim long lists for PDF readability — the live page has scrolling,
  // PDF doesn't.
  const topChannels = data.channels.slice(0, 8);
  const topKeywords = data.keywords.slice(0, 10);
  const topLandings = data.landingPages.slice(0, 10);
  const topUtm = data.utmCampaigns.slice(0, 10);
  const activeDevices = data.devices.filter(d => d.sessions > 0);

  return (
    <Document
      title={`KOKKOK GARDEN — 마케팅 분석 리포트 (${range.label})`}
      author="KOKKOK GARDEN 운영팀"
    >
      {/* ===== Cover ===== */}
      <Page size="A4" style={styles.coverPage}>
        <Text style={styles.coverBrand}>KOKKOK GARDEN</Text>
        <Text style={styles.coverTitle}>마케팅{'\n'}분석 리포트</Text>
        <Text style={styles.coverSubtitle}>
          어디서 들어오고, 무엇을 보고, 어디서 떠났는지에 대한 분석가 보고서.
        </Text>

        <View style={styles.coverMeta}>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>분석 기간</Text>
            <Text style={styles.coverMetaValue}>{range.label}</Text>
          </View>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>생성 시각</Text>
            <Text style={styles.coverMetaValue}>{generatedAt}</Text>
          </View>
          <View style={styles.coverMetaRow}>
            <Text style={styles.coverMetaLabel}>분석 세션</Text>
            <Text style={styles.coverMetaValue}>
              {data.sessions.toLocaleString()}회 (페이지뷰 {data.pageviews.toLocaleString()})
            </Text>
          </View>
        </View>

        <View style={[styles.insightBlock, { marginTop: 48 }]}>
          <Text style={styles.insightLabel}>요약</Text>
          <Text style={styles.insightText}>{executiveSentence(data)}</Text>
        </View>

        <View style={styles.insightBlock}>
          <Text style={styles.insightLabel}>방법</Text>
          <Text style={styles.insightText}>
            동일 방문자의 30분 무활동 기준으로 세션을 묶고, 첫 페이지의 referrer / utm /
            user-agent 로부터 채널 · 기기 · 캠페인을 결정합니다. 이탈률은 단일 페이지로
            끝난 세션의 비율, 참여율은 2페이지 이상 본 세션의 비율입니다.
          </Text>
        </View>

        <Footer pageLabel="표지" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 2: Executive KPIs + Channel + Device ===== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionBlock}>
          <SectionHeading title="핵심 지표" subtitle="선택 기간 vs 이전 동일 기간" />
          <View style={styles.kpiRow}>
            <View style={[styles.kpiCard, { borderLeftColor: '#3b82f6' }]}>
              <Text style={styles.kpiLabel}>총 세션</Text>
              <Text style={styles.kpiValue}>{data.sessions.toLocaleString()}</Text>
              <TrendLabel value={sessionsTrend} />
            </View>
            <View style={[styles.kpiCard, { borderLeftColor: '#22c55e' }]}>
              <Text style={styles.kpiLabel}>참여 세션</Text>
              <Text style={styles.kpiValue}>{data.engagedSessions.toLocaleString()}</Text>
              <TrendLabel value={engagedTrend} />
            </View>
            <View style={[styles.kpiCard, { borderLeftColor: '#ef4444' }]}>
              <Text style={styles.kpiLabel}>이탈률</Text>
              <Text style={styles.kpiValue}>{pct(data.bounceRate)}</Text>
              {/* Inverted: a drop in bounce shows as green ▼. */}
              <TrendLabel value={bouncePoints === 0 ? null : -bouncePoints} />
            </View>
            <View style={[styles.kpiCard, { borderLeftColor: '#8b5cf6' }]}>
              <Text style={styles.kpiLabel}>세션당 페이지</Text>
              <Text style={styles.kpiValue}>{data.avgPagesPerSession.toFixed(1)}</Text>
              <TrendLabel value={pagesTrend} />
            </View>
          </View>
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeading
            title="어디서 들어왔나"
            subtitle="채널별 세션 · 참여율 · 상품 조회율"
          />
          {topChannels.length === 0 ? (
            <Text style={[styles.tdMuted, { paddingVertical: 16, textAlign: 'center' }]}>
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
                    <View
                      style={{
                        height: 4,
                        backgroundColor: COLOR.accent,
                        width: `${widthPct}%`,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                  <Text style={styles.channelMeta}>
                    참여율 {pct(c.engagementRate)} · 상품 조회 {pct(c.productViewRate)}
                  </Text>
                </View>
              );
            })
          )}
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeading
            title="어떤 기기로 보나"
            subtitle="모바일 / 태블릿 / 데스크탑 세션 비율"
          />
          {activeDevices.length === 0 ? (
            <Text style={[styles.tdMuted, { paddingVertical: 12, textAlign: 'center' }]}>
              아직 분석할 기기 데이터가 없습니다
            </Text>
          ) : (
            <View style={styles.table}>
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
        </View>

        <Footer pageLabel="2 · 채널 & 기기" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 3: Keywords + UTM ===== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionBlock}>
          <SectionHeading
            title="무엇을 검색하고 들어왔나"
            subtitle={`검색어 → 상품 조회율 상위 ${topKeywords.length}건`}
          />
          {topKeywords.length === 0 ? (
            <Text style={[styles.tdMuted, { paddingVertical: 12, textAlign: 'center' }]}>
              아직 기록된 검색 키워드가 없습니다 — 네이버 / 다음 등 검색 엔진으로 유입이
              생기면 자동 누적됩니다
            </Text>
          ) : (
            <View style={styles.table}>
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
                      {
                        flex: 1.2,
                        textAlign: 'right',
                        color: conversionColor(k.productViewRate),
                        fontWeight: 700,
                      },
                    ]}
                  >
                    {pct(k.productViewRate)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeading
            title="태그된 캠페인 (UTM)"
            subtitle="유료 광고 클릭 분석"
          />
          {topUtm.length === 0 ? (
            <View style={styles.insightBlock}>
              <Text style={styles.insightLabel}>아직 태그된 캠페인 유입이 없습니다</Text>
              <Text style={styles.insightText}>
                광고 링크에{' '}
                <Text style={{ fontWeight: 700 }}>
                  ?utm_source=naver_ads&utm_medium=cpc&utm_campaign=여름특가
                </Text>{' '}
                형태로 태그를 붙이면, 같은 referrer라도 광고 클릭만 분리해서 측정할 수
                있습니다.
              </Text>
            </View>
          ) : (
            <View style={styles.table}>
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
                      {
                        flex: 1.2,
                        textAlign: 'right',
                        color: conversionColor(u.productViewRate),
                        fontWeight: 700,
                      },
                    ]}
                  >
                    {pct(u.productViewRate)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <Footer pageLabel="3 · 검색어 & 캠페인" generatedAt={generatedAt} />
      </Page>

      {/* ===== Page 4: Landing pages + Time pattern ===== */}
      <Page size="A4" style={styles.page}>
        <View style={styles.sectionBlock}>
          <SectionHeading
            title="어디로 처음 들어왔나"
            subtitle={`랜딩 페이지 상위 ${topLandings.length}건`}
          />
          {topLandings.length === 0 ? (
            <Text style={[styles.tdMuted, { paddingVertical: 12, textAlign: 'center' }]}>
              아직 랜딩 페이지 데이터가 없습니다
            </Text>
          ) : (
            <View style={styles.table}>
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
                      {
                        flex: 1.1,
                        textAlign: 'right',
                        color: conversionColor(p.productViewRate),
                        fontWeight: 700,
                      },
                    ]}
                  >
                    {pct(p.productViewRate)}
                  </Text>
                </View>
              ))}
            </View>
          )}
        </View>

        <View style={styles.sectionBlock}>
          <SectionHeading
            title="언제 들어오나"
            subtitle={
              data.peakDow !== null && data.peakHour !== null
                ? `피크: ${DAY_LABELS[data.peakDow]}요일 ${data.peakHour}시`
                : '요일 × 시간대 세션 시작'
            }
          />
          {heatMax === 0 ? (
            <Text style={[styles.tdMuted, { paddingVertical: 12, textAlign: 'center' }]}>
              아직 분석할 세션이 없습니다
            </Text>
          ) : (
            <View>
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
        </View>

        <Footer pageLabel="4 · 페이지 & 시간대" generatedAt={generatedAt} />
      </Page>
    </Document>
  );
}
