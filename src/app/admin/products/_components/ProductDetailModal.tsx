'use client';

import { X } from 'lucide-react';
import { useState } from 'react';
import { type Product } from '@/lib/api/products';
import type { Category } from '@/lib/api/categories';
import { useModalA11y } from '@/hooks/useModalA11y';
import ProductImageUpload from './ProductImageUpload';
import ProductPriceEditor from './ProductPriceEditor';
import ProductBasicFields from './ProductBasicFields';
import ProductPurchaseSettings from './ProductPurchaseSettings';
import ProductSeoSettings from './ProductSeoSettings';
import DetailComponentsEditor from './DetailComponentsEditor';
import { useProductForm } from './useProductForm';

/**
 * Cafe24-style tabbed product editor.
 *
 * Cafe24's product page exposes 13 tabs (표시설정 / 기본정보 / 판매정보
 * / 옵션·재고 / 이미지정보 / 제작정보 / 상세이용안내 / 아이콘설정 /
 * 배송정보 / 추가구성상품 / 관련상품 / SEO설정 / 메모). We don't have
 * data for most of those — they're commerce concepts (옵션, 배송, 추가
 * 구성) tied to Cafe24's order/inventory layer. So this implementation
 * keeps the four tabs we DO have data for and matches Cafe24's tab
 * chrome (white bg, blue active text + blue border-bottom on the
 * active tab, gray inactive).
 *
 * Tab → content:
 *   기본정보  → image upload + name / summary / ingredient / category
 *   판매정보  → price + originalPrice + naver store url + cart/buy buttons
 *   상세정보  → detail body (legacy) + detail components editor
 *   SEO설정   → existing ProductSeoSettings section
 *
 * All tabs share the same useProductForm state — switching tabs doesn't
 * lose draft input. The save button submits all fields in one go.
 */
interface Props {
  editing: { product: Product | null } | null;
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}

const TABS = ['기본정보', '판매정보', '상세정보', 'SEO설정'] as const;
type Tab = typeof TABS[number];

export default function ProductDetailModal({ editing, categories, onClose, onSaved }: Props) {
  const f = useProductForm(editing, onSaved);
  const dialogRef = useModalA11y(!!editing, onClose);
  const [activeTab, setActiveTab] = useState<Tab>('기본정보');

  if (!editing) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-modal-title"
        className="bg-white rounded-xl shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-[#e5e7eb] flex justify-between items-center bg-[#fafbfc]">
          <h3 id="product-detail-modal-title" className="text-[13px] font-bold text-[#1f2937]">{f.editingId ? '상품 수정' : '새 상품 추가'}</h3>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#1f2937] p-1 rounded hover:bg-[#f3f4f6] transition-colors"
            aria-label="닫기"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Cafe24-style tab strip — white bg, blue active. Each tab is a
            button so keyboard users can Tab + Enter between them. */}
        <div role="tablist" aria-label="상품 편집 탭" className="flex border-b border-[#e5e7eb] bg-white px-2 flex-shrink-0">
          {TABS.map(tab => {
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2.5 text-[12.5px] font-semibold transition-colors border-b-2 -mb-px ${
                  isActive
                    ? 'border-[#1565c0] text-[#1565c0]'
                    : 'border-transparent text-[#6b7280] hover:text-[#1f2937]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <form onSubmit={f.handleSubmit} className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeTab === '기본정보' && (
            <>
              <ProductImageUpload
                previewUrl={f.previewUrl}
                urlValue={f.formData.imageUrl}
                hasFile={!!f.formData.imageFile}
                uploadProgress={f.uploadProgress}
                onFileSelect={f.handleFileSelect}
                onUrlChange={f.onUrlChange}
                onClear={f.onClear}
              />

              <ProductBasicFields
                value={f.formData}
                categories={categories}
                onChange={f.patch}
              />
            </>
          )}

          {activeTab === '판매정보' && (
            <>
              <ProductPriceEditor
                price={f.formData.price}
                originalPrice={f.formData.originalPrice}
                onChangePrice={v => f.patch({ price: v })}
                onChangeOriginalPrice={v => f.patch({ originalPrice: v })}
              />

              <ProductPurchaseSettings
                value={f.formData}
                onChange={f.patch}
              />
            </>
          )}

          {activeTab === '상세정보' && (
            <DetailComponentsEditor
              components={f.formData.detailComponents}
              onChange={next => f.patch({ detailComponents: next })}
            />
          )}

          {activeTab === 'SEO설정' && (
            <ProductSeoSettings
              value={f.formData}
              onChange={f.patch}
            />
          )}
        </form>

        {/* Footer with save buttons — outside the form's overflow-y-auto so
            it stays pinned regardless of which tab's content is taller.
            Form submit triggered via the `form="..."` attribute would be
            ideal but Cafe24 also has a separate footer, so we keep the
            button bound to the form via the implicit close-over by
            putting it inside the form above. Moved out + bound below. */}
        <div className="px-5 py-3 border-t border-[#e5e7eb] flex justify-between items-center bg-[#fafbfc] flex-shrink-0">
          <span className="text-[10.5px] text-[#9ca3af]">탭을 전환해도 입력한 값은 그대로 유지됩니다.</span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-5 py-2 border border-[#d1d5db] text-[#374151] rounded text-[12.5px] font-semibold bg-white hover:bg-[#f9fafb] transition-colors kokkok-keep-border"
            >
              취소
            </button>
            <button
              type="button"
              onClick={() => {
                const form = dialogRef.current?.querySelector('form');
                form?.requestSubmit();
              }}
              disabled={f.isSubmitting}
              className="bg-[#1565c0] text-white px-6 py-2 rounded text-[12.5px] font-bold tracking-wide hover:bg-[#0d47a1] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {f.isSubmitting ? (
                <>
                  <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  저장 중...
                </>
              ) : f.editingId ? '수정 저장' : '상품 저장'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
