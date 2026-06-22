import { useEffect, useState } from 'react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import { uploadFileToS3, USE_S3_FROM_BROWSER } from '@/lib/admin/uploadFile';
import type { Product, DetailComponent } from '@/lib/api/products';
import { extractLegacyImagesAsComponents } from './productDetailHelpers';

const supabase = getSupabaseBrowser();
const BUCKET = 'product-images';

export interface FormState {
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
  // SEO 설정 — Cafe24 product-page "SEO 설정" tab parity. Every field
  // is optional; the storefront generateMetadata falls back to
  // product.name / product.summary when these are empty.
  seoIndexable: boolean;
  seoTitle: string;
  seoAuthor: string;
  seoDescription: string;
  seoKeywords: string;
  seoImageAlt: string;
}

export const EMPTY_FORM: FormState = {
  name: '', summary: '', ingredient: '', price: '', originalPrice: '',
  imageUrl: '', imageFile: null, description: '', detailBody: '',
  detailComponents: [], naverStoreUrl: '', categoryId: '', subcategoryId: '',
  isBestSeller: false, showCartButton: false, showBuyButton: false,
  seoIndexable: true, seoTitle: '', seoAuthor: '', seoDescription: '',
  seoKeywords: '', seoImageAlt: '',
};

/**
 * Owns ProductDetailModal's form state, image preview, upload progress,
 * legacy-row hydration, and the dual-mode (insert vs update) save flow.
 * Returns a `patch()` helper the section components funnel changes
 * through so the parent renders pure UI.
 *
 * Submit: uploads any pending file → builds the DB payload → upserts →
 * fires revalidateHomepageData('products') so storefront cache drops the
 * old row immediately → calls onSaved (parent closes modal + refetches).
 */
export function useProductForm(
  editing: { product: Product | null } | null,
  onSaved: () => void,
) {
  const toast = useToast();
  const editingProduct = editing?.product ?? null;
  const editingId = editingProduct?.id ?? null;

  const [formData, setFormData] = useState<FormState>(EMPTY_FORM);
  const [previewUrl, setPreviewUrl] = useState('');
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Populate the form whenever the modal opens with a different target.
  useEffect(() => {
    if (!editing) return;
    if (!editingProduct) {
      setFormData(EMPTY_FORM);
      setPreviewUrl('');
      setUploadProgress('idle');
      return;
    }
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
        seoIndexable: editingProduct.seo?.indexable ?? true,
        seoTitle: editingProduct.seo?.title ?? '',
        seoAuthor: editingProduct.seo?.author ?? '',
        seoDescription: editingProduct.seo?.description ?? '',
        seoKeywords: editingProduct.seo?.keywords ?? '',
        seoImageAlt: editingProduct.seo?.imageAlt ?? '',
      });
      setPreviewUrl(editingProduct.imageUrl);
      setUploadProgress('idle');
    })();
    return () => { cancelled = true; };
  }, [editing, editingProduct]);

  const patch = (p: Partial<FormState>) => setFormData(prev => ({ ...prev, ...p }));

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPreviewUrl(URL.createObjectURL(file));
    patch({ imageFile: file, imageUrl: '' });
    setUploadProgress('idle');
  };

  const onUrlChange = (url: string) => {
    patch({ imageUrl: url });
    setPreviewUrl(url);
  };

  const onClear = () => {
    setPreviewUrl('');
    patch({ imageFile: null, imageUrl: '' });
    setUploadProgress('idle');
  };

  const uploadImage = async (file: File): Promise<string> => {
    setUploadProgress('uploading');
    try {
      if (USE_S3_FROM_BROWSER) {
        const { publicUrl } = await uploadFileToS3(file, {
          keyPrefix: 'products',
          contentType: file.type,
        });
        setUploadProgress('done');
        return publicUrl;
      }
      if (!supabase) throw new Error('Supabase 클라이언트 없음');
      const ext = file.name.split('.').pop() ?? 'jpg';
      const filePath = `products/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, { cacheControl: '3600', upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(filePath);
      setUploadProgress('done');
      return urlData.publicUrl;
    } catch (err) {
      setUploadProgress('error');
      throw err;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalImageUrl = formData.imageUrl;
      if (formData.imageFile) {
        try {
          finalImageUrl = await uploadImage(formData.imageFile);
        } catch (uploadErr) {
          console.warn('[ProductDetailModal] image upload failed, saving without it:', uploadErr);
          finalImageUrl = '';
        }
      }

      const normalizedComponents: DetailComponent[] = formData.detailComponents.map((c, i) => ({
        ...c,
        sort_order: i,
      }));

      // Build the seo payload only when at least one field carries a
      // value — keeps unset rows as NULL instead of writing an empty
      // object that the storefront would still treat as "configured."
      const seoFields = {
        indexable: formData.seoIndexable,
        title: formData.seoTitle.trim() || null,
        author: formData.seoAuthor.trim() || null,
        description: formData.seoDescription.trim() || null,
        keywords: formData.seoKeywords.trim() || null,
        imageAlt: formData.seoImageAlt.trim() || null,
      };
      const hasSeo = !formData.seoIndexable
        || seoFields.title || seoFields.author || seoFields.description
        || seoFields.keywords || seoFields.imageAlt;

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
        seo: hasSeo ? seoFields : null,
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

  return {
    editingId,
    formData,
    previewUrl,
    uploadProgress,
    isSubmitting,
    patch,
    handleFileSelect,
    onUrlChange,
    onClear,
    handleSubmit,
  };
}
