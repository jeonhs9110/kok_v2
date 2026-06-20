'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import { PageHeader } from '@/components/admin/CafeWidgets';
import {
  DEFAULT_BEST_SELLER_DISPLAY,
  type BestSellerDisplay,
} from '@/lib/api/bestSellerDisplay';
import {
  DEFAULT_THEME_TOKENS,
  parseThemeTokens,
  tokensToCss,
  type ThemeTokens,
} from '@/lib/theme/tokens';

const supabase = getSupabaseBrowser();

const CARD_SCALE_MIN = 0.6;
const CARD_SCALE_MAX = 2.5;
const GAP_X_MAX = 80;
const GAP_Y_MAX = 160;

// Subset of theme_tokens this page now owns. The /admin/theme page lost
// these in the 2026-06-17 reshuffle — operator wanted every BEST SELLER
// surface (card width, gaps, AND the per-element font sizes / image
// ratio) co-located so they aren't toggling between two routes.
type ProductFontTokens = Pick<
  ThemeTokens,
  | 'product_section_title_size'
  | 'product_name_size'
  | 'home_product_summary_size'
  | 'product_price_size'
  | 'home_product_image_ratio'
>;

const PRODUCT_FONT_DEFAULTS: ProductFontTokens = {
  product_section_title_size: DEFAULT_THEME_TOKENS.product_section_title_size,
  product_name_size: DEFAULT_THEME_TOKENS.product_name_size,
  home_product_summary_size: DEFAULT_THEME_TOKENS.home_product_summary_size,
  product_price_size: DEFAULT_THEME_TOKENS.product_price_size,
  home_product_image_ratio: DEFAULT_THEME_TOKENS.home_product_image_ratio,
};

/**
 * /admin/best-seller-display — single source of truth for the homepage
 * BEST SELLER card.
 *
 * Owns two singleton site_settings rows:
 *   - 'best_seller_display' → { card_scale, gap_x, gap_y } (this page's
 *     original scope, migration 39).
 *   - subset of 'theme_tokens' → product font sizes + image aspect ratio
 *     (moved here from /admin/theme on 2026-06-17 per operator ask).
 *     The merge pattern preserves every other theme field so this page
 *     can't accidentally clobber colors, header tokens, etc.
 *
 * Save persists both rows in parallel; a single dirty flag covers both
 * surfaces so the operator sees one "저장" button.
 */
export default function BestSellerDisplayAdminPage() {
  const toast = useToast();
  const [data, setData] = useState<BestSellerDisplay>(DEFAULT_BEST_SELLER_DISPLAY);
  const [saved, setSaved] = useState<BestSellerDisplay>(DEFAULT_BEST_SELLER_DISPLAY);
  const [fonts, setFonts] = useState<ProductFontTokens>(PRODUCT_FONT_DEFAULTS);
  const [savedFonts, setSavedFonts] = useState<ProductFontTokens>(PRODUCT_FONT_DEFAULTS);
  // Full theme_tokens loaded once on mount so the merge-save below
  // never drops a sibling field the operator set on /admin/theme.
  const [fullTokens, setFullTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      const [bsdRes, themeRes] = await Promise.all([
        supabase.from('site_settings').select('value').eq('key', 'best_seller_display').maybeSingle(),
        supabase.from('site_settings').select('value').eq('key', 'theme_tokens').maybeSingle(),
      ]);
      if (bsdRes.data?.value) {
        try {
          const parsed = typeof bsdRes.data.value === 'string' ? JSON.parse(bsdRes.data.value) : bsdRes.data.value;
          if (parsed && typeof parsed === 'object') {
            const next: BestSellerDisplay = {
              card_scale: typeof parsed.card_scale === 'number' ? parsed.card_scale : DEFAULT_BEST_SELLER_DISPLAY.card_scale,
              gap_x: typeof parsed.gap_x === 'number' ? parsed.gap_x : DEFAULT_BEST_SELLER_DISPLAY.gap_x,
              gap_y: typeof parsed.gap_y === 'number' ? parsed.gap_y : DEFAULT_BEST_SELLER_DISPLAY.gap_y,
            };
            setData(next); setSaved(next);
          }
        } catch { /* keep defaults */ }
      }
      const themeRaw = themeRes.data?.value;
      const tokens = parseThemeTokens(typeof themeRaw === 'string' ? safeJson(themeRaw) : themeRaw);
      setFullTokens(tokens);
      const f: ProductFontTokens = {
        product_section_title_size: tokens.product_section_title_size,
        product_name_size: tokens.product_name_size,
        home_product_summary_size: tokens.home_product_summary_size,
        product_price_size: tokens.product_price_size,
        home_product_image_ratio: tokens.home_product_image_ratio,
      };
      setFonts(f); setSavedFonts(f);
      setLoading(false);
    })().catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    try {
      // Merge fonts back into the full theme_tokens so other fields
      // (colors, header sizes, hero heights, etc.) stay intact.
      const mergedTokens: ThemeTokens = { ...fullTokens, ...fonts };
      const [bsdErr, themeErr] = await Promise.all([
        supabase.from('site_settings').upsert(
          { key: 'best_seller_display', value: JSON.stringify(data), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        ).then(r => r.error),
        supabase.from('site_settings').upsert(
          { key: 'theme_tokens', value: JSON.stringify(mergedTokens), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        ).then(r => r.error),
      ]);
      if (bsdErr) throw bsdErr;
      if (themeErr) throw themeErr;
      revalidateHomepageData('best_seller_display');
      // theme tokens consumers (Header, ProductCard, etc.) read fresh
      // CSS on the next render thanks to the layout's inline <style>.
      setSaved(data);
      setSavedFonts(fonts);
      setFullTokens(mergedTokens);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
      toast.show('표시 설정이 저장되었습니다', 'success');
    } catch (err) {
      console.error('[admin/best-seller-display] save failed:', err);
      toast.show('저장에 실패했습니다', 'error');
    } finally {
      setSaving(false);
    }
  }

  // Live preview broadcast. Mirrors the pipeline in /admin/theme: any
  // font/ratio change re-emits the merged theme tokens as CSS, posts
  // to the local <iframe> (standalone view) AND the parent hub
  // (embedded view inside /admin/homepage). The storefront's
  // [lang]/layout listens for kokkok-theme-tokens messages and
  // replaces its <style id="kokkok-theme-tokens"> node — visible
  // change in the 1440px preview without a save round-trip.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const handle = requestAnimationFrame(() => {
      const merged: ThemeTokens = { ...fullTokens, ...fonts };
      const css = tokensToCss(merged);
      if (window.parent !== window) {
        try {
          window.parent.postMessage(
            { type: 'kokkok-theme-tokens', css },
            window.location.origin,
          );
        } catch { /* best-effort */ }
      }
    });
    return () => cancelAnimationFrame(handle);
  }, [fonts, fullTokens]);

  function nudge(field: keyof BestSellerDisplay, step: number, min: number, max: number) {
    setData(prev => {
      const next = Math.max(min, Math.min(max, +(prev[field] + step).toFixed(2)));
      return { ...prev, [field]: next };
    });
  }

  const dirty =
    JSON.stringify(data) !== JSON.stringify(saved) ||
    JSON.stringify(fonts) !== JSON.stringify(savedFonts);
  const previewWidthLg = `calc(${25 * data.card_scale}% - ${data.gap_x * (1 - 1 / 4)}px)`;

  if (loading) return <div className="p-6 text-sm text-gray-500">불러오는 중...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="추천 상품 (BEST SELLER) — 표시 설정"
        description="홈페이지 추천 상품 그리드의 카드 크기, 간격, 글씨 크기를 한 곳에서 조절합니다"
      />

      {/* Mini live preview — 4 placeholder cards laid out with current values */}
      <div className="rounded border border-[#e5e7eb] overflow-hidden">
        <div className="px-3 py-2 text-[11px] text-[#6b7280] bg-[#fafbfc] border-b border-[#e5e7eb]">
          미리보기 (PC 1024px+)
        </div>
        <div className="p-4 bg-white">
          <div
            className="flex flex-wrap justify-center"
            style={{ columnGap: `${data.gap_x}px`, rowGap: `${data.gap_y}px` }}
          >
            {[0, 1, 2, 3].map(i => (
              <div
                key={i}
                style={{ width: previewWidthLg, aspectRatio: fonts.home_product_image_ratio || '5/6' }}
                className="bg-[#f3f4f6] rounded flex items-center justify-center text-[#9ca3af] text-[11px]"
              >
                상품 {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Card scale */}
      <Control
        label="카드 크기"
        hint="추천 상품 카드 자체의 가로 폭. 1.0 = 기본"
        valueLabel={`${data.card_scale.toFixed(2)}×`}
        onMinus={() => nudge('card_scale', -0.05, CARD_SCALE_MIN, CARD_SCALE_MAX)}
        onPlus={() => nudge('card_scale', 0.05, CARD_SCALE_MIN, CARD_SCALE_MAX)}
        sliderProps={{
          min: CARD_SCALE_MIN, max: CARD_SCALE_MAX, step: 0.05,
          value: data.card_scale,
          onChange: e => setData(prev => ({ ...prev, card_scale: +e.target.value })),
        }}
        ticks={[CARD_SCALE_MIN, 1.0, CARD_SCALE_MAX]}
      />

      {/* Gap X */}
      <Control
        label="상품 가로 간격"
        hint="옆 상품과의 좌우 간격 (px)"
        valueLabel={`${data.gap_x}px`}
        onMinus={() => nudge('gap_x', -2, 0, GAP_X_MAX)}
        onPlus={() => nudge('gap_x', 2, 0, GAP_X_MAX)}
        sliderProps={{
          min: 0, max: GAP_X_MAX, step: 1,
          value: data.gap_x,
          onChange: e => setData(prev => ({ ...prev, gap_x: +e.target.value })),
        }}
        ticks={[0, 16, 80]}
      />

      {/* Gap Y */}
      <Control
        label="상품 세로 간격"
        hint="위/아래 상품과의 세로 간격 (px). 한 줄을 넘어가는 경우 적용."
        valueLabel={`${data.gap_y}px`}
        onMinus={() => nudge('gap_y', -4, 0, GAP_Y_MAX)}
        onPlus={() => nudge('gap_y', 4, 0, GAP_Y_MAX)}
        sliderProps={{
          min: 0, max: GAP_Y_MAX, step: 1,
          value: data.gap_y,
          onChange: e => setData(prev => ({ ...prev, gap_y: +e.target.value })),
        }}
        ticks={[0, 48, 160]}
      />

      {/* ── Font sizes (moved from /admin/theme on 2026-06-17) ── */}
      <div className="pt-4 border-t border-[#e5e7eb]">
        <h2 className="text-[13px] font-bold text-[#1f2937] mb-3">글씨 크기 — 홈 BEST SELLER 카드에만 적용</h2>
        <div className="space-y-5">
          <SizePicker
            label="섹션 제목 (BEST SELLER)"
            value={fonts.product_section_title_size}
            fallback={24}
            presets={[
              { v: '20px', l: '작게' },
              { v: '24px', l: '기본' },
              { v: '28px', l: '크게' },
              { v: '32px', l: '더 크게' },
            ]}
            min={16}
            max={48}
            onChange={v => setFonts(f => ({ ...f, product_section_title_size: v }))}
          />
          <SizePicker
            label="제품명"
            value={fonts.product_name_size}
            fallback={15}
            presets={[
              { v: '12px', l: '아주 작게' },
              { v: '13px', l: '작게' },
              { v: '15px', l: '기본' },
              { v: '17px', l: '크게' },
            ]}
            min={11}
            max={22}
            onChange={v => setFonts(f => ({ ...f, product_name_size: v }))}
          />
          <SizePicker
            label="제품 설명 (요약)"
            value={fonts.home_product_summary_size}
            fallback={12}
            presets={[
              { v: '11px', l: '아주 작게' },
              { v: '12px', l: '기본' },
              { v: '13px', l: '크게' },
              { v: '15px', l: '더 크게' },
            ]}
            min={10}
            max={20}
            onChange={v => setFonts(f => ({ ...f, home_product_summary_size: v }))}
          />
          <SizePicker
            label="가격"
            value={fonts.product_price_size}
            fallback={17}
            presets={[
              { v: '13px', l: '작게' },
              { v: '15px', l: '보통' },
              { v: '17px', l: '기본' },
              { v: '20px', l: '크게' },
            ]}
            min={11}
            max={24}
            onChange={v => setFonts(f => ({ ...f, product_price_size: v }))}
          />
          {/* Image aspect ratio — picks the visual presence of the
              product photo. Taller ratios (3/4) make products look
              more imposing; wider (5/4) reads more like a thumbnail. */}
          <div>
            <label className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">제품 이미지 비율 (가로 : 세로)</label>
            <div className="grid grid-cols-5 gap-1 mt-1">
              {[
                { v: '5/4', l: '5:4 (가로형)' },
                { v: '1/1', l: '1:1 (정사각)' },
                { v: '5/6', l: '5:6 (기본)' },
                { v: '4/5', l: '4:5 (세로형)' },
                { v: '3/4', l: '3:4 (긴 세로)' },
              ].map(opt => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() => setFonts(f => ({ ...f, home_product_image_ratio: opt.v }))}
                  className={`px-1 py-1.5 text-[10px] font-semibold border rounded ${
                    fonts.home_product_image_ratio === opt.v
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
                placeholder="예: 4/3, 16/9, 2/3"
                value={fonts.home_product_image_ratio}
                onChange={e => setFonts(f => ({ ...f, home_product_image_ratio: e.target.value }))}
                className="flex-1 px-2 py-1 text-xs font-mono border border-gray-200 rounded focus:outline-none focus:border-gray-400"
              />
            </div>
            <p className="mt-1 text-[10px] text-gray-400">큰 숫자/작은 숫자 = 가로:세로. 5/6 이 기본 (살짝 세로형). 1/1 = 정사각.</p>
          </div>
        </div>
        <p className="text-[10px] text-gray-400 mt-4">
          <strong>홈 메인 페이지의 BEST SELLER 행에만</strong> 적용됩니다.
          /products 목록 페이지나 카트는 기본 크기를 유지합니다 (브라우징 가독성).
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!dirty || saving}
          className="flex items-center gap-2 px-4 py-2 text-[13px] font-semibold text-white bg-[#3b82f6] rounded hover:bg-[#2563eb] disabled:bg-[#9ca3af] disabled:cursor-not-allowed transition-colors"
        >
          <Save className="w-3.5 h-3.5" />
          {saving ? '저장 중...' : '저장'}
        </button>
        {savedFlash && <span className="text-[12px] text-[#059669]">저장됨 ✓</span>}
        <button
          type="button"
          onClick={() => { setData(DEFAULT_BEST_SELLER_DISPLAY); setFonts(PRODUCT_FONT_DEFAULTS); }}
          className="ml-auto text-[12px] text-[#6b7280] hover:text-[#1f2937] underline underline-offset-2"
        >
          기본값으로 리셋
        </button>
      </div>
    </div>
  );
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}

interface ControlProps {
  label: string;
  hint: string;
  valueLabel: string;
  onMinus: () => void;
  onPlus: () => void;
  sliderProps: React.InputHTMLAttributes<HTMLInputElement>;
  ticks: number[];
}

function Control({ label, hint, valueLabel, onMinus, onPlus, sliderProps, ticks }: ControlProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-[#374151]">{label}</div>
          <div className="text-[11px] text-[#9ca3af]">{hint}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onMinus}
            className="w-7 h-7 flex items-center justify-center text-[#6b7280] border border-[#d1d5db] rounded hover:bg-[#f9fafb]"
            aria-label="감소"
          >
            −
          </button>
          <div className="w-16 text-center text-[13px] font-mono font-semibold text-[#1f2937]">
            {valueLabel}
          </div>
          <button
            type="button"
            onClick={onPlus}
            className="w-7 h-7 flex items-center justify-center text-[#6b7280] border border-[#d1d5db] rounded hover:bg-[#f9fafb]"
            aria-label="증가"
          >
            +
          </button>
        </div>
      </div>
      <input type="range" {...sliderProps} className="w-full" />
      <div className="flex justify-between text-[10px] text-[#9ca3af] font-mono px-0.5">
        {ticks.map(t => (
          <span key={t}>{Number.isInteger(t) ? t : t.toFixed(2)}</span>
        ))}
      </div>
    </div>
  );
}

/**
 * Local copy of the SizePicker pattern from /admin/theme — preset row +
 * numeric input, same UX shape so the operator's muscle memory carries
 * over after the move.
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
