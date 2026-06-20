'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';

// Session-aware client. Phase 2 / 5 RLS need the admin JWT for the
// carousel_slides upsert and the storage.objects upload in this modal.
const supabase = getSupabaseBrowser();
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import {
  MAX_FILE_SIZE,
  emptyForm,
  uploadSlideAsset,
  type SlideFormData,
} from '../_lib';
import CarouselSlidePreview from './CarouselSlidePreview';
import SlideDisplayModePicker from './SlideDisplayModePicker';
import SlideTextEditor from './SlideTextEditor';
import SlideColorPicker from './SlideColorPicker';
import SlideFontSizeOffsets from './SlideFontSizeOffsets';
import SlideTypographyAndPosition from './SlideTypographyAndPosition';
import SlideImageUpload from './SlideImageUpload';

interface Props {
  editingId: string | null;
  initialForm?: SlideFormData;
  initialPreviewUrl?: string;
  onClose: () => void;
  onSaved: () => void;
}

export default function CarouselSlideModal({
  editingId,
  initialForm,
  initialPreviewUrl = '',
  onClose,
  onSaved,
}: Props) {
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
  const [uploadProgress, setUploadProgress] = useState<'idle' | 'uploading' | 'done' | 'error'>(
    'idle',
  );
  const [activeLang, setActiveLang] = useState<string>('kr');
  // When this modal is rendered inside /admin/homepage's slide-in editor
  // panel (?embedded=true on the host page), the operator wants ONE
  // preview — the central 1440px storefront iframe — not a redundant
  // CarouselSlidePreview inside the panel. Hide our own previews and
  // let the form fill the available width. The central preview reflects
  // the saved state after the operator clicks 저장; an in-flight live
  // preview pipeline is a follow-up.
  const [isEmbedded, setIsEmbedded] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    setIsEmbedded(new URLSearchParams(window.location.search).get('embedded') === 'true');
  }, []);

  // Live preview pipeline — every formData change posts to the hub which
  // forwards to the central 1440px storefront iframe. The storefront's
  // HeroSlider listens and overlays the in-flight values on the matching
  // slide. Image swaps are post-save only (blob URLs do not survive a
  // postMessage hop). When the modal closes the unmount cleanup sends a
  // null override so the storefront drops back to the persisted slide.
  useEffect(() => {
    if (typeof window === 'undefined' || window.parent === window) return;
    if (!editingId) return; // New slides have no id to overlay yet.
    const override = {
      badge: formData.badge,
      title: formData.title,
      subtitle: formData.subtitle,
      bg_color: formData.bg_color,
      text_color: formData.text_color,
      badge_bg_color: formData.badge_bg_color,
      badge_text_color: formData.badge_text_color,
      title_size_offset: formData.title_size_offset,
      subtitle_size_offset: formData.subtitle_size_offset,
      badge_size_offset: formData.badge_size_offset,
      display_mode: formData.display_mode,
      media_type: formData.media_type,
      link_url: formData.link_url,
      badge_font_family: formData.badge_font_family,
      title_font_family: formData.title_font_family,
      subtitle_font_family: formData.subtitle_font_family,
      badge_bold: formData.badge_bold,
      badge_italic: formData.badge_italic,
      badge_underline: formData.badge_underline,
      title_bold: formData.title_bold,
      title_italic: formData.title_italic,
      title_underline: formData.title_underline,
      subtitle_bold: formData.subtitle_bold,
      subtitle_italic: formData.subtitle_italic,
      subtitle_underline: formData.subtitle_underline,
      text_position: formData.text_position,
      text_position_mobile: formData.text_position_mobile,
      image_position: formData.image_position,
      image_position_mobile: formData.image_position_mobile,
      text_anchor: formData.text_anchor,
      text_anchor_mobile: formData.text_anchor_mobile,
      image_anchor: formData.image_anchor,
      image_anchor_mobile: formData.image_anchor_mobile,
    };
    try {
      window.parent.postMessage(
        { type: 'kokkok-builder-slide-preview', slideId: editingId, override },
        window.location.origin,
      );
    } catch {
      // Ignore — preview is best-effort; save is the source of truth.
    }
  }, [formData, editingId]);

  useEffect(() => {
    return () => {
      if (typeof window === 'undefined' || window.parent === window) return;
      try {
        window.parent.postMessage(
          { type: 'kokkok-builder-slide-preview', slideId: null, override: null },
          window.location.origin,
        );
      } catch {
        // Ignore — modal is closing anyway.
      }
    };
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

    // Soft warning if the source is shorter than the lg hero's 1000px —
    // Next.js will upscale on big screens and the result reads as blurry.
    // We don't block the upload (admin may have a one-off reason), just
    // alert so the underlying issue isn't invisible until the operator
    // sees the banner on a 27" monitor.
    if (!isVideo) {
      const img = new Image();
      // Track the object URL so we can revoke it after the image is decoded
      // — previously every file pick orphaned the blob in memory (debug
      // audit 2026-06-10).
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

  function updateField(field: 'badge' | 'title' | 'subtitle', lang: string, value: string) {
    setFormData(prev => ({ ...prev, [field]: { ...prev[field], [lang]: value } }));
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
      // Mobile image — independent upload. We don't block the slide save
      // if it fails (admin can re-upload later); only the desktop image
      // is required for the slide to be useful at all.
      let finalMobileImageUrl = formData.mobileImageUrl;
      if (formData.mobileImageFile) {
        try {
          finalMobileImageUrl = await uploadSlideAsset(formData.mobileImageFile);
        } catch {
          finalMobileImageUrl = formData.mobileImageUrl;
        }
      }
      const payload = {
        badge: formData.badge,
        title: formData.title,
        subtitle: formData.subtitle,
        image_url: finalImageUrl || null,
        mobile_image_url: finalMobileImageUrl || null,
        bg_color: formData.bg_color,
        text_color: formData.text_color,
        badge_bg_color: formData.badge_bg_color,
        badge_text_color: formData.badge_text_color,
        title_size_offset: formData.title_size_offset,
        subtitle_size_offset: formData.subtitle_size_offset,
        badge_size_offset: formData.badge_size_offset,
        sort_order: parseInt(formData.sort_order) || 0,
        is_active: formData.is_active,
        link_url: formData.link_url || null,
        display_mode: formData.display_mode,
        media_type: formData.media_type,
        badge_font_family: formData.badge_font_family,
        title_font_family: formData.title_font_family,
        subtitle_font_family: formData.subtitle_font_family,
        badge_bold: formData.badge_bold,
        badge_italic: formData.badge_italic,
        badge_underline: formData.badge_underline,
        title_bold: formData.title_bold,
        title_italic: formData.title_italic,
        title_underline: formData.title_underline,
        subtitle_bold: formData.subtitle_bold,
        subtitle_italic: formData.subtitle_italic,
        subtitle_underline: formData.subtitle_underline,
        // Legacy 9-cell keys (kept in sync as a backward-compat rollback
        // safety until the next minor sweep can drop the old columns).
        text_position: formData.text_position,
        text_position_mobile: formData.text_position_mobile,
        image_position: formData.image_position,
        image_position_mobile: formData.image_position_mobile,
        // Migration 30 — JSONB anchors are the real source of truth now.
        text_anchor: formData.text_anchor,
        text_anchor_mobile: formData.text_anchor_mobile,
        image_anchor: formData.image_anchor,
        image_anchor_mobile: formData.image_anchor_mobile,
      };
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

  return (
    <div className={isEmbedded
      ? 'fixed inset-0 z-50 flex items-stretch justify-stretch bg-white'
      : 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200'
    }>
      {/* In embedded mode the modal fills the drawer pane — no backdrop,
          no rounded card, no max-width clamp (the parent drawer width is
          the natural clamp). Outside embedded mode it stays the classic
          centered modal card with backdrop. */}
      <div className={isEmbedded
        ? 'bg-white overflow-hidden flex flex-col w-full h-full'
        : 'bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]'
      }>
        <div className="p-4 border-b border-[#e5e7eb] flex justify-between items-center bg-[#fafbfc]">
          <h3 className="text-[14px] font-bold text-[#1f2937]">
            {editingId ? '슬라이드 수정' : '새 슬라이드 추가'}
          </h3>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#1f2937] p-1 rounded hover:bg-[#f3f4f6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto">
          {/* Two-column layout: form on the left, sticky live preview on
              the right (lg+). In embedded mode (rendered inside the
              homepage builder drawer) we collapse to a single column —
              the central 1440px storefront iframe is the live preview
              the operator wants to watch instead. */}
          <div className={isEmbedded
            ? 'p-6 space-y-5'
            : 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 p-6'
          }>
            <div className="space-y-5 min-w-0">
          {!isEmbedded && (
            <CarouselSlidePreview form={formData} lang={activeLang} previewImageUrl={previewUrl} />
          )}

          <SlideDisplayModePicker
            value={formData.display_mode as 'default' | 'fullpage'}
            onChange={mode => setFormData(prev => ({ ...prev, display_mode: mode }))}
          />

          <SlideImageUpload
            label="슬라이드 이미지 — PC (가로형, 필수)"
            tip={
              /* 권장 해상도 안내. 메인 배너 (HeroSlider) 가 lg:h-[1000px]
                 까지 늘어나기 때문에, 세로 픽셀이 모자란 소스 (예: 2400×800)
                 는 데스크탑에서 25% 이상 업스케일되며 흐릿하게 보입니다.
                 2400×1200(2:1) 이상이 가장 안전합니다. */
              <p className="text-[10px] text-[#92400e] bg-[#fef3c7] border border-[#fde68a] rounded px-2 py-1.5">
                <strong className="font-bold">권장 해상도</strong> · 2400 × 1200 px (2:1) 이상 · 가로폭은 1920 px 이상이면 OK · 세로폭이 1000 px 미만이면 큰 화면에서 흐릿하게 보일 수 있습니다.
              </p>
            }
            previewUrl={previewUrl}
            urlValue={formData.imageUrl}
            isVideo={formData.media_type === 'video'}
            hasFile={!!formData.imageFile}
            uploadProgress={uploadProgress}
            accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
            emptyTitle="클릭하여 이미지 업로드"
            emptySubtitle="JPG, PNG, WEBP, GIF, MP4 — 최대 20MB"
            emptyHint={
              <p className="text-[11px] text-[#9ca3af] mt-2 leading-relaxed text-center">
                권장: <strong className="font-semibold">데스크탑 2400×1500px (16:10) 이상</strong>, 가급적 원본 화질로 업로드해주세요.<br />
                출시 시 자동으로 화면 크기에 맞춰 최적화되며 품질은 95%로 유지됩니다.
              </p>
            }
            emptyHeight="h-36"
            iconSize="w-8 h-8"
            urlPlaceholder="https://example.com/image.jpg"
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

          {/* Migration 35 — optional mobile-specific composition. If the
              admin leaves this empty, HeroSlider falls back to the
              desktop image at every breakpoint, matching pre-2026-06-10
              behavior on rows from before this PR. */}
          <SlideImageUpload
            label="슬라이드 이미지 — 모바일 (세로형, 선택)"
            tip={
              <p className="text-[10px] text-[#1e40af] bg-[#eff6ff] border border-[#bfdbfe] rounded px-2 py-1.5">
                모바일 전용 이미지를 업로드하면 작은 화면에서 자동으로 이 이미지가 표시됩니다. <strong>비워두면 PC 이미지를 그대로 사용</strong>합니다. 권장: 1200 × 1500 px (4:5) 또는 1080 × 1920 px (9:16).
              </p>
            }
            previewUrl={mobilePreviewUrl}
            urlValue={formData.mobileImageUrl}
            hasFile={!!formData.mobileImageFile}
            accept="image/jpeg,image/png,image/webp,image/gif"
            emptyTitle="클릭하여 모바일 이미지 업로드"
            emptySubtitle="선택 사항 — 비워두면 PC 이미지 사용"
            emptyHeight="h-28"
            iconSize="w-6 h-6"
            urlPlaceholder="https://example.com/mobile.jpg"
            onFileSelect={handleMobileFileSelect}
            onUrlChange={url => {
              setFormData(prev => ({ ...prev, mobileImageUrl: url }));
              setMobilePreviewUrl(url);
            }}
            onClear={() => {
              setMobilePreviewUrl('');
              setFormData(prev => ({ ...prev, mobileImageFile: null, mobileImageUrl: '' }));
            }}
          />

          <SlideTextEditor
            formData={formData}
            activeLang={activeLang}
            onChangeLang={setActiveLang}
            onUpdateField={updateField}
            onUpdateLink={url => setFormData(prev => ({ ...prev, link_url: url }))}
          />

          <SlideColorPicker
            formData={formData}
            onChange={(key, value) => setFormData(prev => ({ ...prev, [key]: value }))}
          />

          <SlideFontSizeOffsets
            formData={formData}
            activeLang={activeLang}
            onChange={(key, value) => setFormData(prev => ({ ...prev, [key]: value }))}
          />

          <SlideTypographyAndPosition
            formData={formData}
            previewUrl={previewUrl}
            onChange={patch => setFormData(prev => ({ ...prev, ...patch }))}
          />

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
                표시 순서
              </label>
              <input
                type="number"
                value={formData.sort_order}
                onChange={e => setFormData(prev => ({ ...prev, sort_order: e.target.value }))}
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
                상태
              </label>
              <select
                value={formData.is_active ? 'active' : 'inactive'}
                onChange={e =>
                  setFormData(prev => ({ ...prev, is_active: e.target.value === 'active' }))
                }
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              >
                <option value="active">활성</option>
                <option value="inactive">비활성</option>
              </select>
            </div>
          </div>

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
              ) : editingId ? (
                '수정 저장'
              ) : (
                '슬라이드 저장'
              )}
            </button>
          </div>
            </div>
            {/* Sticky live preview pane — stays in view as the admin
                scrolls the form. Hidden in embedded mode (the homepage
                builder's central iframe is the single source of truth). */}
            {!isEmbedded && (
              <aside className="lg:sticky lg:top-0 lg:self-start">
                <CarouselSlidePreview
                  form={formData}
                  lang={activeLang}
                  previewImageUrl={previewUrl}
                  previewMobileImageUrl={mobilePreviewUrl}
                />
              </aside>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
