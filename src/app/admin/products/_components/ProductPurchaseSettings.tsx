'use client';

interface Value {
  naverStoreUrl: string;
  isBestSeller: boolean;
  showCartButton: boolean;
  showBuyButton: boolean;
}

interface Props {
  value: Value;
  onChange: (patch: Partial<Value>) => void;
}

/**
 * Tail of the product modal — Naver store URL, the best-seller hook for the
 * homepage, and the two purchase-button visibility toggles. Defaults: Naver
 * button is always shown; cart + buy buttons are opt-in per product.
 */
export default function ProductPurchaseSettings({ value, onChange }: Props) {
  return (
    <>
      <div className="space-y-1">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">네이버 스토어 URL</label>
        <input
          type="url"
          value={value.naverStoreUrl}
          onChange={e => onChange({ naverStoreUrl: e.target.value })}
          className="w-full p-2 text-sm rounded"
          placeholder="https://smartstore.naver.com/kokkok-garden/products/..."
        />
        <p className="text-[10px] text-[#9ca3af] mt-1">
          입력하면 고객이 구매하기 클릭 시 네이버 스토어로 이동합니다. 비워두면 자체 결제(추후 KCP)로 연결됩니다.
        </p>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <input
          type="checkbox"
          id="isBestSeller"
          checked={value.isBestSeller}
          onChange={e => onChange({ isBestSeller: e.target.checked })}
          className="w-4 h-4 accent-[#00693A] cursor-pointer"
        />
        <label htmlFor="isBestSeller" className="text-sm font-semibold text-[#374151] cursor-pointer select-none">
          Best Seller로 홈페이지에 노출 (최대 3개)
        </label>
      </div>

      {/* Ingredient tag picker removed 2026-06-19 per boss directive — 주요 성분
          태그 기능 폐기. Existing tags on storefront keep rendering from the DB
          until a follow-up cleanup. */}

      <div className="pt-4 border-t border-[#f3f4f6] space-y-3">
        <p className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">구매 버튼 노출 설정</p>
        <p className="text-[11px] text-[#9ca3af]">기본값: 네이버 스토어 버튼만 노출됩니다. 아래를 켜면 추가로 노출됩니다.</p>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showCartButton"
            checked={value.showCartButton}
            onChange={e => onChange({ showCartButton: e.target.checked })}
            className="w-4 h-4 accent-[#00693A] cursor-pointer"
          />
          <label htmlFor="showCartButton" className="text-sm font-semibold text-[#374151] cursor-pointer select-none">
            장바구니 버튼 노출
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="checkbox"
            id="showBuyButton"
            checked={value.showBuyButton}
            onChange={e => onChange({ showBuyButton: e.target.checked })}
            className="w-4 h-4 accent-[#00693A] cursor-pointer"
          />
          <label htmlFor="showBuyButton" className="text-sm font-semibold text-[#374151] cursor-pointer select-none">
            구매하기 버튼 노출
          </label>
        </div>
      </div>
    </>
  );
}
