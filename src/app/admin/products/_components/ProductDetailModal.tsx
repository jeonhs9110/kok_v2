'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { type Product, type DetailComponent } from '@/lib/api/products';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import type { Category } from '@/lib/api/categories';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import ProductImageUpload from './ProductImageUpload';
import ProductPriceEditor from './ProductPriceEditor';
import ProductBasicFields from './ProductBasicFields';
import ProductPurchaseSettings from './ProductPurchaseSettings';
import DetailComponentsEditor from './DetailComponentsEditor';
import { extractLegacyImagesAsComponents } from './productDetailHelpers';

// Session-aware client. Phase 3 RLS lockdown requires admin's JWT for
// products writes — see migration 19.
const supabase = getSupabaseBrowser();

const BUCKET = 'product-images';

interface FormState {
  name: string;
  summary: string;
  ingredient: string;
  price: string;
  originalPrice: string;
  imageUrl: string;
  imageFile: File | null;
  description: string;
  detailBody: string;
  detailComponents: DetailComponent[];
  naverStoreUrl: string;
  categoryId: string;
  subcategoryId: string;
  isBestSeller: boolean;
  showCartButton: boolean;
  showBuyButton: boolean;
}

const EMPTY_FORM: FormState = {
  name: '', summary: '', ingredient: '', price: '', originalPrice: '',
  imageUrl: '', imageFile: null, description: '', detailBody: '',
  detailComponents: [], naverStoreUrl: '', categoryId: '', subcategoryId: '',
  isBestSeller: false, showCartButton: false, showBuyButton: false,
};

interface Props {
  /** When null the modal is closed. When set, the modal is open in either
   *  "create" (editing.id === null) or "edit" (editing.id is a real id) mode. */
  editing: { product: Product | null } | null;
  categories: Category[];
  onClose: () => void;
  /** Called after a successful save. Parent should refetch + close. */
  onSaved: () => void;
}

export default function ProductDetailModal({
  editing,
  categories,
  onClose,
  onSaved,
}: Props) {
  const toast = useToast();
  const editingProduct = editing?.product ?? null;
  const editingId = editingProduct?.id ?? null;

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate the form whenever the modal opens with a different target.
  // Closing → null editing → next open re-runs this with fresh data.
  useEffect(() => {
    if (!editing) return;
    if (!editingProduct) {
      setFormData(EMPTY_FORM);
      setPreviewUrl('');
      setUploadProgress('idle');
      return;
    }
    // Edit mode — hydrate from the product. Legacy detail_body HTML gets
    // parsed into structured components so old products show their images
    // in the new editor.
    let cancelled = false;
    (async () => {
      const components = editingProduct.detailComponents?.length
        ? editingProduct.detailComponents
        : extractLegacyImagesAsComponents(editingProduct.detailBody || '');
      if (cancelled) return;
      setFormData({
        name: editingProduct.name,
        summary: editingProduct.summary,
        ingredient: editingProduct.ingredient,
        price: String(editingProduct.price),
        originalPrice: String(editingProduct.originalPrice),
        imageUrl: editingProduct.imageUrl,
        imageFile: null,
        description: editingProduct.description,
        detailBody: editingProduct.detailBody || '',
        detailComponents: components,
        naverStoreUrl: editingProduct.naver_store_url || '',
        categoryId: editingProduct.category_id || '',
        subcategoryId: editingProduct.subcategory_id || '',
        isBestSeller: editingProduct.is_best_seller ?? false,
        showCartButton: editingProduct.show_cart_button ?? false,
        showBuyButton: editingProduct.show_buy_button ?? false,
      });
      setPreviewUrl(editingProduct.imageUrl);
      setUploadProgress('idle');
    })();
    return () => { cancelled = true; };
  }, [editing, editingProduct]);

  if (!editing) return null;

  const patch = (p: Partial<FormState>) => setFormData(prev => ({ ...prev, ...p }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    patch({ imageFile: file, imageUrl: '' });
    setUploadProgress('idle');
  };

  const uploadImageToSupabase = async (file: File): Promise<string> => {
    if (!supabase) throw new Error('Supabase 클라이언트 없음');
    setUploadProgress('uploading');
    const ext = file.name.split('.').pop() ?? 'jpg';
    const filePath = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });
    if (uploadError) {
      setUploadProgress('error');
      throw uploadError;
    }
    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
    setUploadProgress('done');
    return urlData.publicUrl;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalImageUrl = formData.imageUrl;
      if (formData.imageFile) {
        try {
          finalImageUrl = await uploadImageToSupabase(formData.imageFile);
        } catch (uploadErr) {
          console.warn('[ProductDetailModal] image upload failed, saving without it:', uploadErr);
          finalImageUrl = '';
        }
      }

      const normalizedComponents: DetailComponent[] = formData.detailComponents.map((c, i) => ({
        ...c,
        sort_order: i,
      }));

      const dbPayload = {
        name: formData.name,
        summary: formData.summary,
        ingredient: formData.ingredient,
        price: Number(formData.price),
        original_price: Number(formData.originalPrice || formData.price),
        description: formData.description,
        detail_body: formData.detailBody,
        detail_components: normalizedComponents,
        images: finalImageUrl ? [finalImageUrl] : [],
        naver_store_url: formData.naverStoreUrl || null,
        category_id: formData.categoryId || null,
        subcategory_id: formData.subcategoryId || null,
        is_best_seller: formData.isBestSeller,
        show_cart_button: formData.showCartButton,
        show_buy_button: formData.showBuyButton,
      };

      if (!supabase) throw new Error('Supabase 클라이언트 없음');

      if (editingId) {
        const { error } = await supabase.from('products').update(dbPayload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('products')
          .insert([{ ...dbPayload, is_active: true }]);
        if (error) throw error;
      }

      revalidateHomepageData('products');
      onSaved();
    } catch (err) {
      console.error('[ProductDetailModal] save failed:', err);
      toast.show('상품 저장에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
        <div className="p-4 border-b border-[#e5e7eb] flex justify-between items-center bg-[#fafbfc]">
          <h3 className="text-[14px] font-bold text-[#1f2937]">{editingId ? '상품 수정' : '새 상품 추가'}</h3>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#1f2937] p-1 rounded hover:bg-[#f3f4f6] transition-colors"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          <ProductImageUpload
            previewUrl={previewUrl}
            urlValue={formData.imageUrl}
            hasFile={!!formData.imageFile}
            uploadProgress={uploadProgress}
            onFileSelect={handleFileSelect}
            onUrlChange={url => {
              patch({ imageUrl: url });
              setPreviewUrl(url);
            }}
            onClear={() => {
              setPreviewUrl('');
              patch({ imageFile: null, imageUrl: '' });
              setUploadProgress('idle');
            }}
          />

          <ProductBasicFields
            value={formData}
            categories={categories}
            onChange={patch}
          />

          <ProductPriceEditor
            price={formData.price}
            originalPrice={formData.originalPrice}
            onChangePrice={v => patch({ price: v })}
            onChangeOriginalPrice={v => patch({ originalPrice: v })}
          />

          <DetailComponentsEditor
            components={formData.detailComponents}
            onChange={next => patch({ detailComponents: next })}
          />

          <ProductPurchaseSettings
            value={formData}
            onChange={patch}
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
              disabled={isSubmitting}
              className="bg-[#3b82f6] text-white px-8 py-2.5 rounded text-sm font-bold tracking-widest hover:bg-[#2563eb] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  저장 중...
                </>
              ) : editingId ? '수정 저장' : '상품 저장'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
