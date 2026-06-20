'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { type Product, type DetailComponent } from '@/lib/api/products';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';

// Session-aware client. Phase 3 RLS lockdown requires admin's JWT for
// products writes — see migration 19.
const supabase = getSupabaseBrowser();
import type { Category } from '@/lib/api/categories';
import { isValidYouTubeUrl } from '@/lib/youtube';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import ProductImageUpload from './ProductImageUpload';
import ProductPriceEditor from './ProductPriceEditor';
import ProductDetailComponentsEditor from './ProductDetailComponentsEditor';

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

/**
 * Convert a legacy `detail_body` HTML blob into structured DetailComponent[]
 * by extracting every <img src=…>. Used only on first edit of products that
 * pre-date the structured-components feature, so the operator sees their
 * existing content in the new editor instead of an empty list.
 */
function extractLegacyImagesAsComponents(detailBody: string): DetailComponent[] {
  if (typeof window === 'undefined') return [];
  try {
    const doc = new DOMParser().parseFromString(detailBody, 'text/html');
    return Array.from(doc.querySelectorAll('img'))
      .map(img => img.getAttribute('src') || '')
      .filter(Boolean)
      .map((url, i) => ({
        id: crypto.randomUUID(),
        type: 'image' as const,
        url,
        sort_order: i,
      }));
  } catch (err) {
    console.warn('[ProductDetailModal] legacy detail_body parse failed:', err);
    return [];
  }
}

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
  const confirm = useConfirm();
  const editingProduct = editing?.product ?? null;
  const editingId = editingProduct?.id ?? null;

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [youtubeInput, setYoutubeInput] = useState('');
  const [youtubeError, setYoutubeError] = useState('');
  const [detailUploading, setDetailUploading] = useState(false);

  // Populate the form whenever the modal opens with a different target.
  // Closing → null editing → next open re-runs this with fresh data.
  useEffect(() => {
    if (!editing) return;
    if (!editingProduct) {
      // Create mode — empty form.
      setFormData(EMPTY_FORM);
      setPreviewUrl('');
      setUploadProgress('idle');
      setYoutubeInput('');
      setYoutubeError('');
      return;
    }
    // Edit mode — hydrate from the product.
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
      setYoutubeInput('');
      setYoutubeError('');
    })();
    return () => { cancelled = true; };
  }, [editing, editingProduct]);

  if (!editing) return null;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    setFormData(prev => ({ ...prev, imageFile: file, imageUrl: '' }));
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

  const addDetailComponent = (c: Omit<DetailComponent, 'sort_order' | 'id'>) => {
    setFormData(prev => ({
      ...prev,
      detailComponents: [
        ...prev.detailComponents,
        { ...c, id: crypto.randomUUID(), sort_order: prev.detailComponents.length },
      ],
    }));
  };

  const removeDetailComponent = (id: string) => {
    setFormData(prev => ({
      ...prev,
      detailComponents: prev.detailComponents.filter(c => c.id !== id),
    }));
  };

  const handleDetailFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isVideo = file.type.startsWith('video/');
    const isImage = file.type.startsWith('image/');
    if (!isVideo && !isImage) {
      toast.show('이미지 또는 영상 파일만 업로드 가능합니다.', 'warning');
      return;
    }
    if (file.size > 30 * 1024 * 1024) {
      const sizeMb = (file.size / 1024 / 1024).toFixed(1);
      const ok = await confirm({ message: `파일 크기가 ${sizeMb}MB로 큽니다. 30MB 이하를 권장합니다. 계속하시겠습니까?`, confirmText: '업로드' });
      if (!ok) return;
    }
    setDetailUploading(true);
    try {
      if (!supabase) throw new Error('Supabase 클라이언트 없음');
      const ext = file.name.split('.').pop() ?? 'bin';
      const path = `detail-components/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from(BUCKET).upload(path, file, {
        cacheControl: '3600', upsert: false, contentType: file.type,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
      addDetailComponent({ type: isVideo ? 'video' : 'image', url: urlData.publicUrl });
    } catch (err) {
      console.error('[ProductDetailModal] detail upload failed:', err);
      toast.show('업로드에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setDetailUploading(false);
    }
  };

  const handleAddYoutube = () => {
    const url = youtubeInput.trim();
    if (!isValidYouTubeUrl(url)) {
      setYoutubeError('유효한 YouTube URL이 아닙니다. (예: https://www.youtube.com/watch?v=...)');
      return;
    }
    setYoutubeError('');
    addDetailComponent({ type: 'youtube', url });
    setYoutubeInput('');
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
          {/* Image upload zone */}
          <ProductImageUpload
            previewUrl={previewUrl}
            urlValue={formData.imageUrl}
            hasFile={!!formData.imageFile}
            uploadProgress={uploadProgress}
            onFileSelect={handleFileSelect}
            onUrlChange={url => {
              setFormData(prev => ({ ...prev, imageUrl: url }));
              setPreviewUrl(url);
            }}
            onClear={() => {
              setPreviewUrl('');
              setFormData(prev => ({ ...prev, imageFile: null, imageUrl: '' }));
              setUploadProgress('idle');
            }}
          />

          {/* Name + Ingredient */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">상품명 *</label>
              <input
                required
                type="text"
                value={formData.name}
                onChange={e => setFormData(prev => ({ ...prev, name: e.target.value }))}
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                placeholder="예: 레티놀 바운스 세럼"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">성분 태그</label>
              <input
                type="text"
                value={formData.ingredient}
                onChange={e => setFormData(prev => ({ ...prev, ingredient: e.target.value }))}
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                placeholder="예: CICA"
              />
            </div>
          </div>

          {/* Category + Subcategory */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">카테고리</label>
              <select
                value={formData.categoryId}
                onChange={e => setFormData(prev => ({ ...prev, categoryId: e.target.value, subcategoryId: '' }))}
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              >
                <option value="">선택 안 함</option>
                {categories.filter(c => !c.parent_id).map(c => (
                  <option key={c.id} value={c.id}>{c.name?.kr || c.slug}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">서브카테고리</label>
              <select
                value={formData.subcategoryId}
                onChange={e => setFormData(prev => ({ ...prev, subcategoryId: e.target.value }))}
                disabled={!formData.categoryId}
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none disabled:opacity-40"
              >
                <option value="">선택 안 함</option>
                {categories.filter(c => c.parent_id === formData.categoryId).map(c => (
                  <option key={c.id} value={c.id}>{c.name?.kr || c.slug}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">한 줄 요약 *</label>
            <input
              required
              type="text"
              value={formData.summary}
              onChange={e => setFormData(prev => ({ ...prev, summary: e.target.value }))}
              className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              placeholder="끈적임없이 촉촉한 기능성 세럼"
            />
          </div>

          {/* Price (with live preview) */}
          <ProductPriceEditor
            price={formData.price}
            originalPrice={formData.originalPrice}
            onChangePrice={v => setFormData(prev => ({ ...prev, price: v }))}
            onChangeOriginalPrice={v => setFormData(prev => ({ ...prev, originalPrice: v }))}
          />

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">한 줄 설명</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none resize-none"
              placeholder="상품의 주요 특징과 성분을 설명해주세요..."
            />
          </div>

          {/* Detail components editor */}
          <ProductDetailComponentsEditor
            components={formData.detailComponents}
            onReorder={next => setFormData(prev => ({ ...prev, detailComponents: next }))}
            onRemove={removeDetailComponent}
            onFileSelect={handleDetailFileSelect}
            isUploading={detailUploading}
            youtubeInput={youtubeInput}
            youtubeError={youtubeError}
            onYoutubeInputChange={v => { setYoutubeInput(v); setYoutubeError(''); }}
            onAddYoutube={handleAddYoutube}
          />

          {/* Naver Store URL */}
          <div className="space-y-1">
            <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">네이버 스토어 URL</label>
            <input
              type="url"
              value={formData.naverStoreUrl}
              onChange={e => setFormData(prev => ({ ...prev, naverStoreUrl: e.target.value }))}
              className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              placeholder="https://smartstore.naver.com/kokkok-garden/products/..."
            />
            <p className="text-[10px] text-gray-400 mt-1">
              입력하면 고객이 구매하기 클릭 시 네이버 스토어로 이동합니다. 비워두면 자체 결제(추후 KCP)로 연결됩니다.
            </p>
          </div>

          {/* Best Seller toggle */}
          <div className="flex items-center gap-3 pt-2">
            <input
              type="checkbox"
              id="isBestSeller"
              checked={formData.isBestSeller}
              onChange={e => setFormData(prev => ({ ...prev, isBestSeller: e.target.checked }))}
              className="w-4 h-4 accent-[#00693A] cursor-pointer"
            />
            <label htmlFor="isBestSeller" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
              Best Seller로 홈페이지에 노출 (최대 3개)
            </label>
          </div>

          {/* Ingredient tag picker removed 2026-06-19 per boss directive
              — 주요 성분 태그 기능 폐기. Existing tags on storefront keep
              rendering from the DB until a follow-up cleanup. Modal stops
              exposing the picker so operator can't tag new products. */}

          {/* Purchase button visibility toggles */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <p className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">구매 버튼 노출 설정</p>
            <p className="text-[11px] text-gray-400">기본값: 네이버 스토어 버튼만 노출됩니다. 아래를 켜면 추가로 노출됩니다.</p>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showCartButton"
                checked={formData.showCartButton}
                onChange={e => setFormData(prev => ({ ...prev, showCartButton: e.target.checked }))}
                className="w-4 h-4 accent-[#00693A] cursor-pointer"
              />
              <label htmlFor="showCartButton" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                장바구니 버튼 노출
              </label>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="showBuyButton"
                checked={formData.showBuyButton}
                onChange={e => setFormData(prev => ({ ...prev, showBuyButton: e.target.checked }))}
                className="w-4 h-4 accent-[#00693A] cursor-pointer"
              />
              <label htmlFor="showBuyButton" className="text-sm font-semibold text-gray-700 cursor-pointer select-none">
                구매하기 버튼 노출
              </label>
            </div>
          </div>

          {/* Actions */}
          <div className="pt-4 border-t border-[#e5e7eb] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-6 py-2.5 border border-[#d1d5db] text-[#374151] rounded text-sm font-semibold bg-white hover:bg-[#f9fafb] transition-colors"
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
