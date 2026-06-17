'use client';

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import {
  DEFAULT_BEST_SELLER_DISPLAY,
  type BestSellerDisplay,
} from '@/lib/api/bestSellerDisplay';

const supabase = getSupabaseBrowser();

const CARD_SCALE_MIN = 0.6;
const CARD_SCALE_MAX = 1.4;
const GAP_X_MAX = 80;
const GAP_Y_MAX = 160;

/**
 * /admin/best-seller-display — operator-editable scale + gap controls
 * for the homepage BEST SELLER product grid. Stored as a singleton
 * site_settings row (migration 39).
 *
 * Three controls:
 *   - 카드 크기 (card_scale): 0.6×–1.4× multiplier on the per-card width
 *   - 상품 가로 간격 (gap_x): 0–80 px horizontal spacing
 *   - 상품 세로 간격 (gap_y): 0–160 px vertical spacing
 *
 * A mini live preview chip at the top mirrors how the storefront will
 * lay out four cards at the current values; saving revalidates the
 * homepage cache so the change appears immediately on /kr.
 */
export default function BestSellerDisplayAdminPage() {
  const [data, setData] = useState<BestSellerDisplay>(DEFAULT_BEST_SELLER_DISPLAY);
  const [saved, setSaved] = useState<BestSellerDisplay>(DEFAULT_BEST_SELLER_DISPLAY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    if (!supabase) { setLoading(false); return; }
    (async () => {
      const { data: row } = await supabase
        .from('site_settings')
        .select('value')
        .eq('key', 'best_seller_display')
        .maybeSingle();
      if (row?.value) {
        try {
          const parsed = typeof row.value === 'string' ? JSON.parse(row.value) : row.value;
          if (parsed && typeof parsed === 'object') {
            const next: BestSellerDisplay = {
              card_scale: typeof parsed.card_scale === 'number' ? parsed.card_scale : DEFAULT_BEST_SELLER_DISPLAY.card_scale,
              gap_x: typeof parsed.gap_x === 'number' ? parsed.gap_x : DEFAULT_BEST_SELLER_DISPLAY.gap_x,
              gap_y: typeof parsed.gap_y === 'number' ? parsed.gap_y : DEFAULT_BEST_SELLER_DISPLAY.gap_y,
            };
            setData(next);
            setSaved(next);
          }
        } catch { /* keep defaults */ }
      }
      setLoading(false);
    })().catch(() => setLoading(false));
  }, []);

  async function handleSave() {
    if (!supabase) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('site_settings')
        .upsert(
          { key: 'best_seller_display', value: JSON.stringify(data), updated_at: new Date().toISOString() },
          { onConflict: 'key' },
        );
      if (error) throw error;
      revalidateHomepageData('best_seller_display');
      setSaved(data);
      setSavedFlash(true);
      setTimeout(() => setSavedFlash(false), 2000);
    } catch (err) {
      console.error('[admin/best-seller-display] save failed:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }

  function nudge(field: keyof BestSellerDisplay, step: number, min: number, max: number) {
    setData(prev => {
      const next = Math.max(min, Math.min(max, +(prev[field] + step).toFixed(2)));
      return { ...prev, [field]: next };
    });
  }

  const dirty = JSON.stringify(data) !== JSON.stringify(saved);
  const previewWidthLg = `calc(${25 * data.card_scale}% - ${data.gap_x * (1 - 1 / 4)}px)`;

  if (loading) return <div className="p-6 text-sm text-gray-500">불러오는 중...</div>;

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-lg font-bold text-[#1f2937]">추천 상품 (BEST SELLER) — 표시 설정</h1>
        <p className="text-[12px] text-[#6b7280] mt-1">
          홈페이지 추천 상품 그리드의 카드 크기와 간격을 조절합니다.
        </p>
      </div>

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
                style={{ width: previewWidthLg }}
                className="aspect-[5/6] bg-[#f3f4f6] rounded flex items-center justify-center text-[#9ca3af] text-[11px]"
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
          onClick={() => setData(DEFAULT_BEST_SELLER_DISPLAY)}
          className="ml-auto text-[12px] text-[#6b7280] hover:text-[#1f2937] underline underline-offset-2"
        >
          기본값으로 리셋
        </button>
      </div>
    </div>
  );
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
