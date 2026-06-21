'use client';

import { X } from 'lucide-react';
import { type Product } from '@/lib/api/products';
import type { Category } from '@/lib/api/categories';
import { useModalA11y } from '@/hooks/useModalA11y';
import ProductImageUpload from './ProductImageUpload';
import ProductPriceEditor from './ProductPriceEditor';
import ProductBasicFields from './ProductBasicFields';
import ProductPurchaseSettings from './ProductPurchaseSettings';
import DetailComponentsEditor from './DetailComponentsEditor';
import { useProductForm } from './useProductForm';

interface Props {
  /** When null the modal is closed. When set, the modal is open in either
   *  "create" (editing.product === null) or "edit" (editing.product is set) mode. */
  editing: { product: Product | null } | null;
  categories: Category[];
  onClose: () => void;
  /** Called after a successful save. Parent should refetch + close. */
  onSaved: () => void;
}

export default function ProductDetailModal({ editing, categories, onClose, onSaved }: Props) {
  const f = useProductForm(editing, onSaved);
  const dialogRef = useModalA11y(!!editing, onClose);

  if (!editing) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="product-detail-modal-title"
        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-[#e5e7eb] flex justify-between items-center bg-[#fafbfc]">
          <h3 id="product-detail-modal-title" className="text-[14px] font-bold text-[#1f2937]">{f.editingId ? '상품 수정' : '새 상품 추가'}</h3>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#1f2937] p-1 rounded hover:bg-[#f3f4f6] transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={f.handleSubmit} className="p-6 overflow-y-auto space-y-5">
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

          <ProductPriceEditor
            price={f.formData.price}
            originalPrice={f.formData.originalPrice}
            onChangePrice={v => f.patch({ price: v })}
            onChangeOriginalPrice={v => f.patch({ originalPrice: v })}
          />

          <DetailComponentsEditor
            components={f.formData.detailComponents}
            onChange={next => f.patch({ detailComponents: next })}
          />

          <ProductPurchaseSettings
            value={f.formData}
            onChange={f.patch}
          />

          <div className="pt-4 border-t border-[#e5e7eb] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-[#d1d5db] text-[#374151] rounded text-sm font-semibold bg-white hover:bg-[#f9fafb] transition-colors kokkok-keep-border"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={f.isSubmitting}
              className="bg-[#3b82f6] text-white px-8 py-2.5 rounded text-sm font-bold tracking-widest hover:bg-[#2563eb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {f.isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  저장 중...
                </>
              ) : f.editingId ? '수정 저장' : '상품 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
