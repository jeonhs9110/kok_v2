'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { useToast } from '@/components/admin/Toast';
import { PageHeader, LoadingState } from '@/components/admin/CafeWidgets';
import { safeJson } from './_components/BestSellerPrimitives';
import BestSellerLayoutControls from './_components/BestSellerLayoutControls';
import BestSellerFontControls, { type ProductFontTokens } from './_components/BestSellerFontControls';
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

const PRODUCT_FONT_DEFAULTS: ProductFontTokens = {
  product_section_title_size: DEFAULT_THEME_TOKENS.product_section_title_size,
  product_name_size: DEFAULT_THEME_TOKENS.product_name_size,
  home_product_summary_size: DEFAULT_THEME_TOKENS.home_product_summary_size,
  product_price_size: DEFAULT_THEME_TOKENS.product_price_size,
  home_product_image_ratio: DEFAULT_THEME_TOKENS.home_product_image_ratio,
};

/**
 * /admin/best-seller-display — single source of truth for the homepage
 * BEST SELLER card. Owns the 'best_seller_display' singleton (scale/gaps)
 * AND a subset of 'theme_tokens' (product font sizes + image aspect ratio).
 * Merge-on-save preserves every other theme field so colors/header tokens
 * are never clobbered by changes the operator made on /admin/theme.
 */
export default function BestSellerDisplayAdminPage() {
  const toast = useToast();
  const [data, setData] = useState<BestSellerDisplay>(DEFAULT_BEST_SELLER_DISPLAY);
  const [saved, setSaved] = useState<BestSellerDisplay>(DEFAULT_BEST_SELLER_DISPLAY);
  const [fonts, setFonts] = useState<ProductFontTokens>(PRODUCT_FONT_DEFAULTS);
  const [savedFonts, setSavedFonts] = useState<ProductFontTokens>(PRODUCT_FONT_DEFAULTS);
  const [fullTokens, setFullTokens] = useState<ThemeTokens>(DEFAULT_THEME_TOKENS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/admin/site-settings?keys=best_seller_display,theme_tokens', { cache: 'no-store' });
        if (res.ok) {
          const json = (await res.json()) as { values?: Record<string, unknown> };
          const bsdRaw = json.values?.best_seller_display;
          if (bsdRaw) {
            try {
              const parsed = typeof bsdRaw === 'string' ? JSON.parse(bsdRaw) : bsdRaw;
              if (parsed && typeof parsed === 'object') {
                const next: BestSellerDisplay = {
                  card_scale: typeof (parsed as { card_scale?: number }).card_scale === 'number' ? (parsed as { card_scale: number }).card_scale : DEFAULT_BEST_SELLER_DISPLAY.card_scale,
                  gap_x: typeof (parsed as { gap_x?: number }).gap_x === 'number' ? (parsed as { gap_x: number }).gap_x : DEFAULT_BEST_SELLER_DISPLAY.gap_x,
                  gap_y: typeof (parsed as { gap_y?: number }).gap_y === 'number' ? (parsed as { gap_y: number }).gap_y : DEFAULT_BEST_SELLER_DISPLAY.gap_y,
                };
                setData(next); setSaved(next);
              }
            } catch { /* keep defaults */ }
          }
          const themeRaw = json.values?.theme_tokens;
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
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function handleSave() {
    setSaving(true);
    try {
      const mergedTokens: ThemeTokens = { ...fullTokens, ...fonts };
      const res = await fetch('/api/admin/site-settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: [
            { key: 'best_seller_display', value: JSON.stringify(data) },
            { key: 'theme_tokens', value: JSON.stringify(mergedTokens) },
          ],
        }),
      });
      if (!res.ok) throw new Error('http_' + res.status);
      revalidateHomepageData('best_seller_display');
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

  // Live preview broadcast. Any font/ratio change re-emits the merged
  // theme tokens as CSS; the parent hub (embedded view) relays it to
  // its central preview iframe so the operator sees changes without save.
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

  const dirty =
    JSON.stringify(data) !== JSON.stringify(saved) ||
    JSON.stringify(fonts) !== JSON.stringify(savedFonts);

  if (loading) return <LoadingState />;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <PageHeader
        title="추천 상품 (BEST SELLER) — 표시 설정"
        description="홈페이지 추천 상품 그리드의 카드 크기, 간격, 글씨 크기를 한 곳에서 조절합니다"
      />

      <BestSellerLayoutControls
        data={data}
        fontsRatio={fonts.home_product_image_ratio}
        onChange={setData}
      />

      <BestSellerFontControls fonts={fonts} onChange={setFonts} />

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
        {savedFlash && <span className="text-[12px] text-[#16a34a]">저장됨 ✓</span>}
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
