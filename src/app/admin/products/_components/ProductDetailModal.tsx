'use client';

import { useState, useEffect, useRef } from 'react';
import {
  X, Upload, GripVertical, Trash2, Film, Image as ImgIcon, Eye,
} from 'lucide-react';
import { type Product, type DetailComponent } from '@/lib/api/products';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { useConfirm } from '@/components/admin/ConfirmModal';

// Session-aware client. Phase 3 RLS lockdown requires admin's JWT for
// products writes — see migration 19.
const supabase = getSupabaseBrowser();
import type { Category } from '@/lib/api/categories';
import { isValidYouTubeUrl, toYouTubeThumbnailUrl, isYouTubeShortsUrl } from '@/lib/youtube';
import ProductDetailComponents from '@/components/ProductDetailComponents';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import SortableList from '@/components/admin/SortableList';

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

/** Inline YouTube glyph — kept local since it's only used by this editor. */
function YtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  );
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const detailFileInputRef = useRef<HTMLInputElement>(null);

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
            className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"
            aria-label="닫기"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5">
          {/* Image upload zone */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">상품 이미지</label>
            <div
              className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer group ${
                previewUrl ? 'border-gray-200' : 'border-gray-200 hover:border-gray-400'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={previewUrl} alt="미리보기" className="w-full h-52 object-contain rounded-xl bg-gray-50" />
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setPreviewUrl('');
                      setFormData(prev => ({ ...prev, imageFile: null, imageUrl: '' }));
                      setUploadProgress('idle');
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  {uploadProgress === 'uploading' && (
                    <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                      <div className="text-sm text-gray-700 font-semibold animate-pulse">업로드 중...</div>
                    </div>
                  )}
                  {uploadProgress === 'done' && (
                    <div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">
                      ✓ 업로드 완료
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-40 flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-600 transition-colors">
                  <Upload className="w-8 h-8 mb-2" />
                  <p className="text-sm font-semibold">클릭하여 이미지 업로드</p>
                  <p className="text-xs mt-1">JPG, PNG, WEBP — 최대 10MB</p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleFileSelect}
            />
            {!formData.imageFile && (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-[10px] text-gray-400 font-semibold">또는 URL 직접 입력</span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, imageUrl: e.target.value }));
                    setPreviewUrl(e.target.value);
                  }}
                  placeholder="https://example.com/image.jpg"
                  className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                />
              </>
            )}
          </div>

          {/* Name + Ingredient */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">상품명 *</label>
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
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">성분 태그</label>
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
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">카테고리</label>
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
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">서브카테고리</label>
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
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">한 줄 요약 *</label>
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
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">현재 판매가 (원) *</label>
                <input
                  required
                  type="number"
                  min="0"
                  value={formData.price}
                  onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                  placeholder="23400"
                />
                <p className="text-[10px] text-gray-400 leading-snug">실제로 결제되는 가격입니다.</p>
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">할인 전 가격 (취소선)</label>
                <input
                  type="number"
                  min="0"
                  value={formData.originalPrice}
                  onChange={e => setFormData(prev => ({ ...prev, originalPrice: e.target.value }))}
                  className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                  placeholder="예: 26000 (판매가보다 높게)"
                />
                <p className="text-[10px] text-gray-400 leading-snug">
                  <strong className="text-gray-600">현재 판매가보다 높을 때만</strong> 취소선으로 표시됩니다. 할인 없으면 비워두세요.
                </p>
              </div>
            </div>
            {formData.price && (() => {
              const p = Number(formData.price) || 0;
              const op = Number(formData.originalPrice) || 0;
              const hasDiscount = op > p;
              const hasBackwardsInput = op > 0 && op <= p;
              const discountPct = hasDiscount ? Math.round(((op - p) / op) * 100) : 0;
              return (
                <div className="bg-gradient-to-br from-gray-50 to-white border border-gray-200 rounded-lg p-4">
                  <p className="text-[10px] font-bold tracking-widest text-gray-400 uppercase mb-2.5">사이트 미리보기</p>
                  <div className="flex items-end gap-3 flex-wrap">
                    {hasDiscount && (
                      <span className="text-[#f15a24] font-bold text-base mb-0.5 tracking-tight">{discountPct}%</span>
                    )}
                    <span className="text-2xl font-extrabold tracking-tight text-brand-ink">
                      {p.toLocaleString()}<span className="text-base font-bold ml-0.5">원</span>
                    </span>
                    {hasDiscount && (
                      <span className="text-neutral-400 line-through text-sm font-medium mb-1">{op.toLocaleString()}원</span>
                    )}
                  </div>
                  {hasBackwardsInput && (
                    <div className="mt-3 flex items-start gap-2 text-[11px] text-amber-800 bg-amber-50 border border-amber-200 rounded px-2.5 py-2 leading-relaxed">
                      <span className="font-bold shrink-0">⚠</span>
                      <span>
                        할인 전 가격({op.toLocaleString()}원)이 현재 판매가({p.toLocaleString()}원)보다 높지 않아 취소선이 표시되지 않습니다.
                        두 값을 바꾸셨거나, 할인이 없는 경우 할인 전 가격을 비워두세요.
                      </span>
                    </div>
                  )}
                  {!hasDiscount && !hasBackwardsInput && (
                    <p className="text-[10px] text-gray-400 mt-2">할인 표시 없이 판매가만 노출됩니다.</p>
                  )}
                </div>
              );
            })()}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">한 줄 설명</label>
            <textarea
              rows={3}
              value={formData.description}
              onChange={e => setFormData(prev => ({ ...prev, description: e.target.value }))}
              className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none resize-none"
              placeholder="상품의 주요 특징과 성분을 설명해주세요..."
            />
          </div>

          {/* Detail components editor */}
          <div className="space-y-3">
            <div className="flex items-baseline justify-between">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">상세페이지 컴포넌트</label>
              <span className="text-[10px] text-gray-400">위 → 아래 순서, 컴포넌트 간 마진 없이 이어붙음</span>
            </div>

            {formData.detailComponents.length === 0 ? (
              <div className="border-2 border-dashed border-gray-200 rounded-xl p-6 text-center text-gray-400 text-xs">
                아직 추가된 컴포넌트가 없습니다. 아래에서 이미지/영상/YouTube를 추가하세요.
              </div>
            ) : (
              <SortableList
                items={formData.detailComponents}
                getId={(c) => c.id}
                onReorder={(next) => setFormData(prev => ({ ...prev, detailComponents: next }))}
                className="space-y-2"
              >
                {(c, { dragHandleProps }) => {
                  const i = formData.detailComponents.findIndex(x => x.id === c.id);
                  const TypeIcon = c.type === 'youtube' ? YtIcon : c.type === 'video' ? Film : ImgIcon;
                  const typeBadge = c.type === 'youtube' ? 'YouTube' : c.type === 'video' ? '영상' : '이미지';
                  const badgeColor =
                    c.type === 'youtube' ? 'bg-red-50 text-red-700' :
                    c.type === 'video' ? 'bg-purple-50 text-purple-700' :
                    'bg-blue-50 text-blue-700';
                  const thumbnail = c.type === 'youtube' ? toYouTubeThumbnailUrl(c.url) : c.type === 'image' ? c.url : '';
                  return (
                    <div className="border border-gray-200 rounded-lg p-3 flex gap-3 items-center bg-white">
                      <button
                        type="button"
                        {...dragHandleProps}
                        className={`${dragHandleProps.className ?? ''} text-gray-300 hover:text-gray-600 p-1`}
                        aria-label="드래그하여 순서 변경"
                      >
                        <GripVertical className="w-4 h-4" />
                      </button>
                      <div className="text-[10px] font-bold text-gray-400 w-5 text-center select-none">{i + 1}</div>
                      <div className="w-20 h-14 bg-gray-100 rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
                        {thumbnail ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                        ) : (
                          <Film className="w-6 h-6 text-gray-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded ${badgeColor}`}>
                            <TypeIcon className="w-3 h-3" />
                            {typeBadge}
                          </span>
                          {c.type === 'youtube' && isYouTubeShortsUrl(c.url) && (
                            <span className="px-1.5 py-0.5 bg-orange-50 text-orange-700 text-[9px] font-bold rounded">Shorts</span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate" title={c.url}>{c.url}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeDetailComponent(c.id)}
                        className="p-1.5 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  );
                }}
              </SortableList>
            )}

            {formData.detailComponents.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Eye className="w-3.5 h-3.5 text-gray-400" />
                  <p className="text-[10px] font-bold tracking-widest text-gray-500 uppercase">사이트 미리보기</p>
                  <span className="text-[10px] text-gray-400 ml-auto">실제 스토어 페이지와 동일한 모습 (스토어 폭은 더 넓음)</span>
                </div>
                <div className="border border-gray-200 rounded-lg overflow-hidden bg-white">
                  <ProductDetailComponents components={formData.detailComponents} />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              <button
                type="button"
                onClick={() => detailFileInputRef.current?.click()}
                disabled={detailUploading}
                className="border border-dashed border-gray-300 rounded-lg p-3 text-xs font-semibold text-gray-700 hover:border-black hover:bg-gray-50 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Upload className="w-4 h-4" />
                {detailUploading ? '업로드 중...' : '파일 업로드 (이미지/영상)'}
              </button>
              <input
                ref={detailFileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
                className="hidden"
                onChange={handleDetailFileSelect}
              />
              <div className="border border-dashed border-gray-300 rounded-lg p-2 flex items-center gap-1.5">
                <YtIcon className="w-4 h-4 text-red-600 flex-shrink-0 ml-1" />
                <input
                  type="url"
                  value={youtubeInput}
                  onChange={e => { setYoutubeInput(e.target.value); setYoutubeError(''); }}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddYoutube(); } }}
                  placeholder="YouTube URL"
                  className="flex-1 text-xs bg-transparent outline-none min-w-0"
                />
                <button
                  type="button"
                  onClick={handleAddYoutube}
                  className="px-2.5 py-1 bg-black text-white text-[11px] font-bold rounded hover:bg-gray-800"
                >
                  추가
                </button>
              </div>
            </div>
            {youtubeError && <p className="text-[10px] text-red-600">{youtubeError}</p>}
            <p className="text-[10px] text-gray-400 leading-snug pt-1">
              이미지(PNG/JPG/WEBP/GIF), 영상(MP4), YouTube 링크를 추가하면 상세페이지 하단에 위→아래로 마진 없이 이어붙어 표시됩니다.
              영상 파일은 <strong className="text-gray-600">30MB 이하 권장</strong>. YouTube Shorts URL 사용 시 자동으로 세로 비율(9:16)로 표시됩니다.
            </p>
          </div>

          {/* Naver Store URL */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">네이버 스토어 URL</label>
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
            <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">구매 버튼 노출 설정</p>
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
              className="px-6 py-2.5 border border-gray-200 text-gray-600 rounded text-sm font-semibold hover:bg-gray-50 transition-colors"
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
