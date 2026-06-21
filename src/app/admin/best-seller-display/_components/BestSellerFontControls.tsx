'use client';

import { SizePicker } from './BestSellerPrimitives';
import type { ThemeTokens } from '@/lib/theme/tokens';

export type ProductFontTokens = Pick<
  ThemeTokens,
  | 'product_section_title_size'
  | 'product_name_size'
  | 'home_product_summary_size'
  | 'product_price_size'
  | 'home_product_image_ratio'
>;

interface Props {
  fonts: ProductFontTokens;
  onChange: (next: ProductFontTokens) => void;
}

const IMAGE_RATIO_PRESETS = [
  { v: '5/4', l: '5:4 (가로형)' },
  { v: '1/1', l: '1:1 (정사각)' },
  { v: '5/6', l: '5:6 (기본)' },
  { v: '4/5', l: '4:5 (세로형)' },
  { v: '3/4', l: '3:4 (긴 세로)' },
];

export default function BestSellerFontControls({ fonts, onChange }: Props) {
  const patch = (p: Partial<ProductFontTokens>) => onChange({ ...fonts, ...p });

  return (
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
          onChange={v => patch({ product_section_title_size: v })}
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
          onChange={v => patch({ product_name_size: v })}
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
          onChange={v => patch({ home_product_summary_size: v })}
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
          onChange={v => patch({ product_price_size: v })}
        />
        {/* Image aspect ratio — taller (3/4) reads imposing; wider (5/4) reads thumbnail. */}
        <div>
          <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">제품 이미지 비율 (가로 : 세로)</label>
          <div className="grid grid-cols-5 gap-1 mt-1">
            {IMAGE_RATIO_PRESETS.map(opt => (
              <button
                key={opt.v}
                type="button"
                onClick={() => patch({ home_product_image_ratio: opt.v })}
                className={`px-1 py-1.5 text-[10px] font-semibold border rounded ${
                  fonts.home_product_image_ratio === opt.v
                    ? 'bg-[#1f2937] text-white border-[#1f2937]'
                    : 'bg-white text-[#374151] border-[#e5e7eb] hover:border-[#9ca3af] kokkok-keep-border'
                }`}
              >
                {opt.l}
              </button>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <label className="text-[10px] font-bold tracking-widest text-[#6b7280] uppercase">직접 입력</label>
            <input
              type="text"
              placeholder="예: 4/3, 16/9, 2/3"
              value={fonts.home_product_image_ratio}
              onChange={e => patch({ home_product_image_ratio: e.target.value })}
              className="flex-1 px-2 py-1 text-xs font-mono rounded"
            />
          </div>
          <p className="mt-1 text-[10px] text-[#9ca3af]">큰 숫자/작은 숫자 = 가로:세로. 5/6 이 기본 (살짝 세로형). 1/1 = 정사각.</p>
        </div>
      </div>
      <p className="text-[10px] text-[#9ca3af] mt-4">
        <strong>홈 메인 페이지의 BEST SELLER 행에만</strong> 적용됩니다.
        /products 목록 페이지나 카트는 기본 크기를 유지합니다 (브라우징 가독성).
      </p>
    </div>
  );
}
