'use client';

/**
 * Price + discount editor for the product modal. Two inputs (현재 판매가 /
 * 할인 전 가격) and a live preview card showing what the storefront will
 * render — including a discount-% chip when the cancel-line price is
 * legitimately higher, and a warning banner when the values are
 * backwards (operator likely fat-fingered the higher into the lower).
 *
 * Extracted from ProductDetailModal at 2026-06-21 — same shape as
 * carousel modal's section extractions, props in / callbacks out.
 */

interface Props {
  price: string;
  originalPrice: string;
  onChangePrice: (value: string) => void;
  onChangeOriginalPrice: (value: string) => void;
}

export default function ProductPriceEditor({
  price,
  originalPrice,
  onChangePrice,
  onChangeOriginalPrice,
}: Props) {
  const p = Number(price) || 0;
  const op = Number(originalPrice) || 0;
  const hasDiscount = op > p;
  const hasBackwardsInput = op > 0 && op <= p;
  const discountPct = hasDiscount ? Math.round(((op - p) / op) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
            현재 판매가 (원) *
          </label>
          <input
            required
            type="number"
            min="0"
            value={price}
            onChange={e => onChangePrice(e.target.value)}
            className="w-full rounded px-3 py-2 text-sm"
            placeholder="23400"
          />
          <p className="text-[10px] text-[#9ca3af] leading-snug">실제로 결제되는 가격입니다.</p>
        </div>
        <div className="space-y-1">
          <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
            할인 전 가격 (취소선)
          </label>
          <input
            type="number"
            min="0"
            value={originalPrice}
            onChange={e => onChangeOriginalPrice(e.target.value)}
            className="w-full rounded px-3 py-2 text-sm"
            placeholder="예: 26000 (판매가보다 높게)"
          />
          <p className="text-[10px] text-[#9ca3af] leading-snug">
            <strong className="text-[#374151]">현재 판매가보다 높을 때만</strong> 취소선으로
            표시됩니다. 할인 없으면 비워두세요.
          </p>
        </div>
      </div>

      {price && (
        <div className="bg-gradient-to-br from-[#fafbfc] to-white border border-[#e5e7eb] rounded p-4">
          <p className="text-[10px] font-bold tracking-widest text-[#9ca3af] uppercase mb-2.5">
            사이트 미리보기
          </p>
          <div className="flex items-end gap-3 flex-wrap">
            {hasDiscount && (
              <span className="text-[#f15a24] font-bold text-base mb-0.5 tracking-tight">
                {discountPct}%
              </span>
            )}
            <span className="text-2xl font-extrabold tracking-tight text-brand-ink">
              {p.toLocaleString()}
              <span className="text-base font-bold ml-0.5">원</span>
            </span>
            {hasDiscount && (
              <span className="text-[#9ca3af] line-through text-sm font-medium mb-1">
                {op.toLocaleString()}원
              </span>
            )}
          </div>
          {hasBackwardsInput && (
            <div className="mt-3 flex items-start gap-2 text-[11px] text-[#92400e] bg-[#fef3c7] border border-[#fde68a] rounded px-2.5 py-2 leading-relaxed">
              <span className="font-bold shrink-0">⚠</span>
              <span>
                할인 전 가격({op.toLocaleString()}원)이 현재 판매가({p.toLocaleString()}원)보다
                높지 않아 취소선이 표시되지 않습니다. 두 값을 바꾸셨거나, 할인이 없는 경우 할인
                전 가격을 비워두세요.
              </span>
            </div>
          )}
          {!hasDiscount && !hasBackwardsInput && (
            <p className="text-[10px] text-[#9ca3af] mt-2">할인 표시 없이 판매가만 노출됩니다.</p>
          )}
        </div>
      )}
    </div>
  );
}
