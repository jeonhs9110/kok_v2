'use client';

import { Control } from './BestSellerPrimitives';
import type { BestSellerDisplay } from '@/lib/api/bestSellerDisplay';

interface Props {
  data: BestSellerDisplay;
  fontsRatio: string;
  onChange: (next: BestSellerDisplay) => void;
}

const CARD_SCALE_MIN = 0.6;
const CARD_SCALE_MAX = 2.5;
const GAP_X_MAX = 80;
const GAP_Y_MAX = 160;

export default function BestSellerLayoutControls({ data, fontsRatio, onChange }: Props) {
  const nudge = (field: keyof BestSellerDisplay, step: number, min: number, max: number) => {
    const next = Math.max(min, Math.min(max, +(data[field] + step).toFixed(2)));
    onChange({ ...data, [field]: next });
  };
  const previewWidthLg = `calc(${25 * data.card_scale}% - ${data.gap_x * (1 - 1 / 4)}px)`;

  return (
    <>
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
                style={{ width: previewWidthLg, aspectRatio: fontsRatio || '5/6' }}
                className="bg-[#f3f4f6] rounded flex items-center justify-center text-[#9ca3af] text-[11px]"
              >
                상품 {i + 1}
              </div>
            ))}
          </div>
        </div>
      </div>

      <Control
        label="카드 크기"
        hint="추천 상품 카드 자체의 가로 폭. 1.0 = 기본"
        valueLabel={`${data.card_scale.toFixed(2)}×`}
        onMinus={() => nudge('card_scale', -0.05, CARD_SCALE_MIN, CARD_SCALE_MAX)}
        onPlus={() => nudge('card_scale', 0.05, CARD_SCALE_MIN, CARD_SCALE_MAX)}
        sliderProps={{
          min: CARD_SCALE_MIN, max: CARD_SCALE_MAX, step: 0.05,
          value: data.card_scale,
          onChange: e => onChange({ ...data, card_scale: +e.target.value }),
        }}
        ticks={[CARD_SCALE_MIN, 1.0, CARD_SCALE_MAX]}
      />

      <Control
        label="상품 가로 간격"
        hint="옆 상품과의 좌우 간격 (px)"
        valueLabel={`${data.gap_x}px`}
        onMinus={() => nudge('gap_x', -2, 0, GAP_X_MAX)}
        onPlus={() => nudge('gap_x', 2, 0, GAP_X_MAX)}
        sliderProps={{
          min: 0, max: GAP_X_MAX, step: 1,
          value: data.gap_x,
          onChange: e => onChange({ ...data, gap_x: +e.target.value }),
        }}
        ticks={[0, 16, 80]}
      />

      <Control
        label="상품 세로 간격"
        hint="위/아래 상품과의 세로 간격 (px). 한 줄을 넘어가는 경우 적용."
        valueLabel={`${data.gap_y}px`}
        onMinus={() => nudge('gap_y', -4, 0, GAP_Y_MAX)}
        onPlus={() => nudge('gap_y', 4, 0, GAP_Y_MAX)}
        sliderProps={{
          min: 0, max: GAP_Y_MAX, step: 1,
          value: data.gap_y,
          onChange: e => onChange({ ...data, gap_y: +e.target.value }),
        }}
        ticks={[0, 48, 160]}
      />
    </>
  );
}
