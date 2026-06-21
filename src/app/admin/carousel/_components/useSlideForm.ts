import { useEffect, useMemo, useState } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import {
  MAX_FILE_SIZE,
  emptyForm,
  uploadSlideAsset,
  buildSlidePayload,
  type SlideFormData,
} from '../_lib';

const supabase = getSupabaseBrowser();

/**
 * Owns CarouselSlideModal's form state, dual image previews (PC + mobile),
 * upload progress, the unsaved-change guard, the file-select handlers
 * (with the 1000px-minimum natural-height warning + blob URL cleanup),
 * the embedded-drawer detection, and the dual-upload save flow.
 *
 * Mobile image upload is best-effort — if it fails we keep the desktop
 * image and let the operator re-upload later. Failing the slide save on
 * a mobile-only error would be too aggressive.
 */
export function useSlideForm(
  editingId: string | null,
  initialForm: SlideFormData | undefined,
  initialPreviewUrl: string,
  onSaved: () => void,
) {
  const toast = useToast();

  const initialFormRef = useMemo(
    () => initialForm ?? { ...emptyForm, badge: {}, title: {}, subtitle: {} },
    // Snapshot once at mount; later edits compare against this. Re-snapshotting
    // would defeat the unsaved-change guard.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [formData, setFormData] = useState<SlideFormData>(initialFormRef);
  useUnsavedChanges(JSON.stringify(formData) !== JSON.stringify(initialFormRef));
  const [previewUrl, setPreviewUrl] = useState(initialPreviewUrl);
  const [mobilePreviewUrl, setMobilePreviewUrl] = useState(initialForm?.mobileImageUrl ?? '');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>('idle');
  const [activeLang, setActiveLang] = useState<string>('kr');

  // Embedded detection (?embedded=true). When true, the modal renders
  // full-width inside the homepage drawer pane and hides its own preview;
  // the central 1440px storefront iframe in the hub is the canonical preview.
  const [isEmbedded, setIsEmbedded] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsEmbedded(new URLSearchParams(window.location.search).get('embedded') === 'true');
  }, []);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.show('파일 크기가 20MB를 초과합니다.', 'warning');
      return;
    }
    const isVideo = file.type.startsWith('video/');
    const isGif = file.type === 'image/gif';
    const mediaType = isVideo ? 'video' : isGif ? 'gif' : 'image';
    setPreviewUrl(URL.createObjectURL(file));
    setFormData(prev => ({ ...prev, imageFile: file, imageUrl: '', media_type: mediaType }));
    setUploadProgress('idle');

    // Soft warning when source is shorter than the lg hero's 1000px —
    // Next.js will upscale on big screens and the result reads as blurry.
    if (!isVideo) {
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      const cleanup = () => URL.revokeObjectURL(objectUrl);
      img.onload = () => {
        if (img.naturalHeight < 1000) {
          toast.show(
            `세로 픽셀 ${img.naturalHeight}px — 큰 화면에서 흐릿할 수 있습니다 (권장: 2400×1200 이상)`,
            'warning',
          );
        }
        cleanup();
      };
      img.onerror = cleanup;
      img.src = objectUrl;
    }
  }

  function handleMobileFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.show('파일 크기가 20MB를 초과합니다.', 'warning');
      return;
    }
    setMobilePreviewUrl(URL.createObjectURL(file));
    setFormData(prev => ({ ...prev, mobileImageFile: file, mobileImageUrl: '' }));
  }

  function updateField(field: 'badge' | 'title' | 'subtitle', lang: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: { ...prev[field], [lang]: value } }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      let finalImageUrl = formData.imageUrl;
      if (formData.imageFile) {
        try {
          setUploadProgress('uploading');
          finalImageUrl = await uploadSlideAsset(formData.imageFile);
          setUploadProgress('done');
        } catch {
          setUploadProgress('error');
          finalImageUrl = '';
        }
      }
      // Mobile image — best-effort. Failing the slide save on a mobile-only
      // error would be too aggressive; admin can re-upload later.
      let finalMobileImageUrl = formData.mobileImageUrl;
      if (formData.mobileImageFile) {
        try {
          finalMobileImageUrl = await uploadSlideAsset(formData.mobileImageFile);
        } catch {
          finalMobileImageUrl = formData.mobileImageUrl;
        }
      }
      const payload = buildSlidePayload(formData, finalImageUrl, finalMobileImageUrl);
      if (!supabase) throw new Error('클라이언트 없음');
      if (editingId) {
        const { error } = await supabase
          .from('carousel_slides')
          .update(payload)
          .eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('carousel_slides').insert([payload]);
        if (error) throw error;
      }
      revalidateHomepageData('carousel');
      onSaved();
    } catch (err) {
      console.error('슬라이드 저장 실패:', err);
      toast.show('저장에 실패했습니다.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  return {
    formData,
    setFormData,
    previewUrl,
    setPreviewUrl,
    mobilePreviewUrl,
    setMobilePreviewUrl,
    isSubmitting,
    uploadProgress,
    setUploadProgress,
    activeLang,
    setActiveLang,
    isEmbedded,
    handleFileSelect,
    handleMobileFileSelect,
    updateField,
    handleSubmit,
  };
}
