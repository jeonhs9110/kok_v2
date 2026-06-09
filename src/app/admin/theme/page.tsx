'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Palette, RefreshCw, Save, RotateCcw, Eye } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import {
  DEFAULT_THEME_TOKENS,
  parseThemeTokens,
  tokensToCss,
  type ThemeTokens,
} from '@/lib/theme/tokens';
import { FONT_OPTIONS } from '@/lib/typography/options';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';

// Session-aware client. site_settings writes require admin JWT (Phase 2 RLS).
const supabase = getSupabaseBrowser();

/**
 * /admin/theme — live theme tokens editor.
 *
 * Two-pane layout:
 *   left  → color pickers + radius + font inputs
 *   right → iframe pointing at /kr that receives postMessage updates
 *           on every change, no reload required.
 *
 * Save flow writes the JSON-encoded tokens to the `theme_tokens` row in
 * site_settings. The next public page load picks up the change via
 * getThemeTokens() in [lang]/layout. Other admin tabs already pointed
 * at /kr (the live preview iframe here) update via postMessage on save.
 */
export default function ThemePage() {
  const [tokens, setTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [savedTokens, setSavedTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);
  const [previewLang, setPreviewLang] = useState<'kr' | 'en'>('kr');
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const fetchTokens = useCallback(async () => {
    setIsLoading(true);
    try {
      if (!supabase) throw new Error('no client');
      const { data } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'theme_tokens')
        .maybeSingle();
      const parsed = parseThemeTokens(data?.value);
      setTokens(parsed);
      setSavedTokens(parsed);
    } catch (err) {
      console.error('[admin/theme] load failed:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchTokens(); }, [fetchTokens]);

  // Push live updates to the iframe on every token change. Debounced
  // via rAF to coalesce rapid color-picker drags into one paint.
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      const iframe = iframeRef.current;
      if (!iframe || !iframe.contentWindow) return;
      iframe.contentWindow.postMessage(
        { type: 'kokkok-theme-tokens', css: tokensToCss(tokens) },
        window.location.origin,
      );
    });
    return () => cancelAnimationFrame(handle);
  }, [tokens]);

  const handleSave = async () => {
    if (!supabase) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          { key: 'theme_tokens', value: JSON.stringify(tokens), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
      setSavedTokens(tokens);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2500);
    } catch (err) {
      console.error('[admin/theme] save failed:', err);
      alert(err instanceof Error ? err.message : '저장 실패');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    if (!confirm('기본값으로 되돌리시겠습니까? 저장 전까지는 변경 사항이 반영되지 않습니다.')) return;
    setTokens(DEFAULT_THEME_TOKENS);
  };

  const handleRevert = () => {
    setTokens(savedTokens);
  };

  const isDirty = JSON.stringify(tokens) !== JSON.stringify(savedTokens);
  useUnsavedChanges(isDirty);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6">
      {/* Editor pane */}
      <aside className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col max-h-[calc(100vh-180px)]">
        <div className="p-5 border-b border-gray-100 bg-gray-50/50">
          <div className="flex items-center gap-2 mb-1">
            <Palette className="w-5 h-5 text-gray-500" />
            <h2 className="font-bold text-gray-800">테마 편집</h2>
          </div>
          <p className="text-xs text-gray-500">
            오른쪽 미리보기에 실시간으로 반영됩니다. 저장 전에는 사이트에 적용되지 않습니다.
          </p>
        </div>

        <div className="overflow-y-auto p-5 space-y-5 flex-1">
          {isLoading ? (
            <div className="text-center text-sm text-gray-400 py-10">불러오는 중...</div>
          ) : (
            <>
              <Section title="브랜드 색상">
                <ColorRow label="잉크 (본문/타이틀)" value={tokens.color_brand_ink}
                  onChange={v => setTokens(t => ({ ...t, color_brand_ink: v }))} />
                <ColorRow label="액센트 (할인 표시)" value={tokens.color_brand_accent}
                  onChange={v => setTokens(t => ({ ...t, color_brand_accent: v }))} />
                <ColorRow label="뮤트 (보조 텍스트)" value={tokens.color_brand_muted}
                  onChange={v => setTokens(t => ({ ...t, color_brand_muted: v }))} />
                <ColorRow label="프라이머리 (긍정/저장)" value={tokens.color_brand_primary}
                  onChange={v => setTokens(t => ({ ...t, color_brand_primary: v }))} />
                <ColorRow label="공지 시작 (그라데이션)" value={tokens.color_brand_notice_from}
                  onChange={v => setTokens(t => ({ ...t, color_brand_notice_from: v }))} />
                <ColorRow label="공지 끝 (그라데이션)" value={tokens.color_brand_notice_to}
                  onChange={v => setTokens(t => ({ ...t, color_brand_notice_to: v }))} />
              </Section>

              <Section title="모양">
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">버튼 모서리</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {[
                      { v: '0px', l: '직각' },
                      { v: '6px', l: '약간' },
                      { v: '12px', l: '둥글게' },
                      { v: '9999px', l: '알약' },
                    ].map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setTokens(t => ({ ...t, radius_button: opt.v }))}
                        className={`p-2 text-xs font-semibold border ${
                          tokens.radius_button === opt.v
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'
                        }`}
                        style={{ borderRadius: opt.v === '9999px' ? '9999px' : opt.v }}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">헤더 메뉴 글씨 크기</label>
                  {/* Preset picker mirrors the button-radius UX; each option
                      previews at its own font-size so the admin sees the
                      relative difference at a glance. */}
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {/* Labels renamed 2026-06-08 after the default moved
                        13.5px → 15px (tokens.ts). The picker now anchors
                        '기본' on the new 15px default so 송이 doesn't see
                        '크게' selected by default on a fresh install. */}
                    {[
                      { v: '13.5px', l: '작게' },
                      { v: '15px',   l: '기본' },
                      { v: '17px',   l: '크게' },
                      { v: '19px',   l: '더 크게' },
                    ].map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setTokens(t => ({ ...t, header_menu_font_size: opt.v }))}
                        className={`p-2 font-semibold border rounded ${
                          tokens.header_menu_font_size === opt.v
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}
                        style={{ fontSize: opt.v }}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">홈페이지 상단 메뉴 (상품·메뉴·Shop Worldwide) 글씨 크기. 모바일 메뉴도 함께 조절됩니다.</p>
                </div>

                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">서브 히어로 배너 — 서브타이틀 글씨 크기</label>
                  <div className="grid grid-cols-5 gap-1.5 mt-1">
                    {[
                      { v: '14px', l: '아주 작게' },
                      { v: '16px', l: '작게' },
                      { v: '18px', l: '기본' },
                      { v: '20px', l: '크게' },
                      { v: '24px', l: '더 크게' },
                    ].map(opt => (
                      <button
                        key={opt.v}
                        type="button"
                        onClick={() => setTokens(t => ({ ...t, subhero_subtitle_size: opt.v }))}
                        className={`p-2 font-semibold border rounded ${
                          tokens.subhero_subtitle_size === opt.v
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}
                        style={{ fontSize: opt.v }}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                  {/* Direct numeric input for any value the presets don't
                      cover (e.g. 17px between 작게 16 and 기본 18).
                      Range-clamped to 12–28px so a typo can't blow up
                      the layout. Saves on blur via the same dirty-state
                      bottom save bar. */}
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">
                      직접 입력
                    </label>
                    <input
                      type="number"
                      min={12}
                      max={28}
                      step={1}
                      value={parseInt(tokens.subhero_subtitle_size, 10) || 18}
                      onChange={e => {
                        const raw = parseInt(e.target.value, 10);
                        if (!Number.isFinite(raw)) return;
                        const clamped = Math.max(12, Math.min(28, raw));
                        setTokens(t => ({ ...t, subhero_subtitle_size: `${clamped}px` }));
                      }}
                      className="w-20 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-gray-400"
                    />
                    <span className="text-[10px] text-gray-500">px (12–28)</span>
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">메인 히어로 캐러셀 아래 서브 배너의 작은 부제목 글씨 크기. 개별 배너 옵션(/admin/sub-hero)에서 추가 조정 가능.</p>
                </div>
              </Section>

              <Section title="메인 배너 (히어로) 크기">
                <SizePicker
                  label="높이 — 모바일 (640px 미만)"
                  value={tokens.hero_height_mobile}
                  fallback={700}
                  presets={[
                    { v: '480px',  l: '낮게' },
                    { v: '600px',  l: '보통' },
                    { v: '700px',  l: '기본' },
                    { v: '820px',  l: '높게' },
                  ]}
                  min={320}
                  max={1200}
                  onChange={v => setTokens(t => ({ ...t, hero_height_mobile: v }))}
                />
                <SizePicker
                  label="높이 — 태블릿 (640–1023px)"
                  value={tokens.hero_height_tablet}
                  fallback={900}
                  presets={[
                    { v: '640px',  l: '낮게' },
                    { v: '800px',  l: '보통' },
                    { v: '900px',  l: '기본' },
                    { v: '1040px', l: '높게' },
                  ]}
                  min={480}
                  max={1400}
                  onChange={v => setTokens(t => ({ ...t, hero_height_tablet: v }))}
                />
                <SizePicker
                  label="높이 — 데스크탑 (1024px 이상)"
                  value={tokens.hero_height_desktop}
                  fallback={1000}
                  presets={[
                    { v: '720px',  l: '낮게' },
                    { v: '880px',  l: '보통' },
                    { v: '1000px', l: '기본' },
                    { v: '1200px', l: '높게' },
                  ]}
                  min={520}
                  max={1600}
                  onChange={v => setTokens(t => ({ ...t, hero_height_desktop: v }))}
                />
                <div>
                  <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">가로 최대 너비 (선택)</label>
                  <div className="grid grid-cols-4 gap-1.5 mt-1">
                    {[
                      { v: '',       l: '전체 폭' },
                      { v: '1920px', l: '1920' },
                      { v: '1600px', l: '1600' },
                      { v: '1280px', l: '1280' },
                    ].map(opt => (
                      <button
                        key={opt.v || 'full'}
                        type="button"
                        onClick={() => setTokens(t => ({ ...t, hero_max_width: opt.v }))}
                        className={`p-2 font-semibold border rounded text-xs ${
                          tokens.hero_max_width === opt.v
                            ? 'bg-black text-white border-black'
                            : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">직접 입력</label>
                    <input
                      type="text"
                      placeholder="예: 1440px / 100% / 비워두면 전체"
                      value={tokens.hero_max_width}
                      onChange={e => setTokens(t => ({ ...t, hero_max_width: e.target.value }))}
                      className="flex-1 px-2 py-1 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:border-gray-400"
                    />
                  </div>
                  <p className="mt-1 text-[10px] text-gray-400">기본은 화면 전체. 값을 넣으면 그 폭으로 가운데 정렬됩니다 (와이드 모니터에서 letterbox).</p>
                </div>
                <p className="text-[10px] text-gray-400">메인 페이지 상단 캐러셀의 세 화면 크기별 높이 + 가로 너비. 미리보기에 실시간으로 반영됩니다.</p>
              </Section>

              <Section title="홈 추천 상품 글씨">
                <SizePicker
                  label="섹션 제목 (BEST SELLER)"
                  value={tokens.product_section_title_size}
                  fallback={24}
                  presets={[
                    { v: '20px', l: '작게' },
                    { v: '24px', l: '기본' },
                    { v: '28px', l: '크게' },
                    { v: '32px', l: '더 크게' },
                  ]}
                  min={16}
                  max={48}
                  onChange={v => setTokens(t => ({ ...t, product_section_title_size: v }))}
                />
                <SizePicker
                  label="제품명"
                  value={tokens.product_name_size}
                  fallback={15}
                  presets={[
                    { v: '12px', l: '아주 작게' },
                    { v: '13px', l: '작게' },
                    { v: '15px', l: '기본' },
                    { v: '17px', l: '크게' },
                  ]}
                  min={11}
                  max={22}
                  onChange={v => setTokens(t => ({ ...t, product_name_size: v }))}
                />
                <SizePicker
                  label="가격"
                  value={tokens.product_price_size}
                  fallback={17}
                  presets={[
                    { v: '13px', l: '작게' },
                    { v: '15px', l: '보통' },
                    { v: '17px', l: '기본' },
                    { v: '20px', l: '크게' },
                  ]}
                  min={11}
                  max={24}
                  onChange={v => setTokens(t => ({ ...t, product_price_size: v }))}
                />
                <p className="text-[10px] text-gray-400">홈페이지 메인 디스플레이 + 모든 제품 카드에 적용됩니다. (어드민 패널, 장바구니 제외)</p>
              </Section>

              <Section title="타이포그래피 (선택)">
                <FontRow label="본문 폰트" value={tokens.font_body}
                  onChange={v => setTokens(t => ({ ...t, font_body: v }))} />
                <FontRow label="제목 폰트 (H1~H6)" value={tokens.font_display}
                  onChange={v => setTokens(t => ({ ...t, font_display: v }))} />
                <FontRow label="헤더 / 메뉴 폰트" value={tokens.font_header}
                  onChange={v => setTokens(t => ({ ...t, font_header: v }))} />
                <FontRow label="버튼 폰트 (CTA)" value={tokens.font_button}
                  onChange={v => setTokens(t => ({ ...t, font_button: v }))} />
                <FontRow label="가격 폰트 (숫자)" value={tokens.font_price}
                  onChange={v => setTokens(t => ({ ...t, font_price: v }))} />
                <p className="text-[10px] text-gray-400">
                  드롭다운에서 사이트가 미리 로드한 8개 폰트 중 하나를 고르거나, &quot;기타 (직접 입력)&quot;를
                  선택해 시스템에 설치된 폰트명 또는 Google Fonts 폰트 패밀리 문자열을 직접 입력할 수 있습니다.
                  비워두면 본문 폰트(또는 브랜드 기본값)를 따릅니다.
                </p>
              </Section>
            </>
          )}
        </div>

        <div className="border-t border-gray-100 p-4 flex flex-wrap items-center gap-2 bg-gray-50/50">
          <button
            type="button"
            onClick={handleSave}
            disabled={!isDirty || isSaving}
            className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-bold tracking-wider rounded-lg transition ${
              savedFlash
                ? 'bg-green-600 text-white'
                : isDirty
                ? 'bg-brand-ink text-white hover:bg-black'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Save className="w-4 h-4" />
            {isSaving ? '저장 중...' : savedFlash ? '✓ 저장 완료' : isDirty ? '변경 사항 저장' : '저장된 상태'}
          </button>
          <button
            type="button"
            onClick={handleRevert}
            disabled={!isDirty}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold tracking-wider border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition disabled:opacity-40"
            title="저장된 상태로 되돌리기"
          >
            <RefreshCw className="w-3.5 h-3.5" /> 되돌리기
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 px-3 py-2.5 text-xs font-bold tracking-wider border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 transition"
            title="기본값으로 리셋 (저장 안 함)"
          >
            <RotateCcw className="w-3.5 h-3.5" /> 기본값
          </button>
        </div>
      </aside>

      {/* Preview pane */}
      <section className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden flex flex-col">
        <div className="p-3 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-gray-500" />
            <span className="text-sm font-bold text-gray-700">실시간 미리보기</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="inline-flex bg-gray-100 rounded p-0.5 text-[11px] font-bold">
              {(['kr', 'en'] as const).map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setPreviewLang(l)}
                  className={`px-2.5 py-1 rounded transition ${
                    previewLang === l ? 'bg-white shadow-sm text-black' : 'text-gray-500'
                  }`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
            <a
              href={`/${previewLang}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11px] text-gray-500 hover:text-black underline"
            >
              새 탭
            </a>
          </div>
        </div>
        <div className="flex-1 min-h-[600px] bg-gray-100 relative">
          <iframe
            ref={iframeRef}
            src={`/${previewLang}`}
            className="absolute inset-0 w-full h-full bg-white"
            title="storefront preview"
          />
        </div>
      </section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h3 className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function ColorRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 min-w-0">
        <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
        <div className="flex items-center gap-2 mt-1">
          <input
            type="color"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-9 h-9 rounded border border-gray-200 cursor-pointer p-0"
          />
          <input
            type="text"
            value={value}
            onChange={e => onChange(e.target.value)}
            className="flex-1 border border-gray-200 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-black"
          />
        </div>
      </div>
    </div>
  );
}

/**
 * Reusable preset+numeric size picker for px-string tokens. Mirrors the
 * inline pattern used by the header_menu_font_size and subhero_subtitle
 * controls, extracted so the new product-text tokens (section title,
 * name, price) don't each carry their own copy of the chrome.
 */
function SizePicker({
  label, value, fallback, presets, min, max, onChange,
}: {
  label: string;
  value: string;
  fallback: number;
  presets: { v: string; l: string }[];
  min: number;
  max: number;
  onChange: (v: string) => void;
}) {
  const parsed = parseInt(value, 10);
  const safe = Number.isFinite(parsed) ? parsed : fallback;
  return (
    <div>
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <div className="grid grid-cols-4 gap-1.5 mt-1">
        {presets.map(opt => (
          <button
            key={opt.v}
            type="button"
            onClick={() => onChange(opt.v)}
            className={`p-2 font-semibold border rounded ${
              value === opt.v
                ? 'bg-black text-white border-black'
                : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
            }`}
            style={{ fontSize: opt.v }}
          >
            {opt.l}
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <label className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">직접 입력</label>
        <input
          type="number"
          min={min}
          max={max}
          step={1}
          value={safe}
          onChange={e => {
            const raw = parseInt(e.target.value, 10);
            if (!Number.isFinite(raw)) return;
            onChange(`${Math.max(min, Math.min(max, raw))}px`);
          }}
          className="w-20 px-2 py-1 text-xs border border-gray-200 rounded focus:outline-none focus:border-gray-400"
        />
        <span className="text-[10px] text-gray-500">px ({min}–{max})</span>
      </div>
    </div>
  );
}

/**
 * Font picker for the theme tokens. Stores the CSS font-family string
 * (same shape `font_body` / `font_display` always had) so existing
 * theme_tokens rows keep rendering unchanged, but presents a dropdown
 * of the 8 brand + Google-loaded fonts the rest of the admin uses.
 *
 * "기타 (직접 입력)" reveals the legacy text input so an admin can paste
 * any CSS family stack — handy when previewing a font we haven't added
 * to FONT_OPTIONS yet.
 *
 * Mode is derived from `value`: if the stored string matches any of
 * FONT_OPTIONS[].cssFamily exactly, the dropdown shows that entry;
 * otherwise it falls into "custom" mode and reveals the text field.
 * Switching from custom back to a preset clears the text field.
 */
function FontRow({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const presetMatch = FONT_OPTIONS.find(f => f.cssFamily === value);
  const isCustom = value.trim() !== '' && !presetMatch;
  const selectValue = value.trim() === '' ? '' : presetMatch ? presetMatch.key : '__custom__';

  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{label}</label>
      <select
        value={selectValue}
        onChange={e => {
          const v = e.target.value;
          if (v === '') onChange('');                // back to brand default
          else if (v === '__custom__') onChange(value || ' ');  // stay in custom (force non-empty so chip shows)
          else {
            const opt = FONT_OPTIONS.find(f => f.key === v);
            if (opt) onChange(opt.cssFamily);
          }
        }}
        className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs bg-white outline-none focus:border-black"
      >
        <option value="">기본 (비워둠 — 브랜드 폰트)</option>
        {FONT_OPTIONS.map(f => (
          <option key={f.key} value={f.key}>
            {f.label} — {f.hint}
          </option>
        ))}
        <option value="__custom__">기타 (직접 입력)</option>
      </select>
      {isCustom && (
        <input
          type="text"
          value={value}
          placeholder='예: "Helvetica Neue", system-ui, sans-serif'
          onChange={e => onChange(e.target.value)}
          className="w-full border border-gray-200 rounded px-2 py-1.5 text-xs font-mono outline-none focus:border-black"
        />
      )}
    </div>
  );
}
