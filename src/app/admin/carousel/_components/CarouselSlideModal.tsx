'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { Upload, X } from 'lucide-react';
import { getSupabaseBrowser } from '@/lib/supabase/browser';
import { useToast } from '@/components/admin/Toast';

// Session-aware client. Phase 2 / 5 RLS need the admin JWT for the
// carousel_slides upsert and the storage.objects upload in this modal.
const supabase = getSupabaseBrowser();
import { SUPPORTED_LANGS, LANG_LABELS } from '@/lib/i18n/types';
import { revalidateHomepageData } from '@/lib/cache/invalidate';
import {
  MAX_FILE_SIZE,
  emptyForm,
  uploadSlideAsset,
  type SlideFormData,
} from '../_lib';
import CarouselSlidePreview from './CarouselSlidePreview';
import { TypographyPanel } from '@/components/admin/TypographyPanel';
import ContinuousPositionPicker from '@/components/admin/ContinuousPositionPicker';

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mobileFileInputRef = useRef<HTMLInputElement>(null);
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
            className="text-gray-400 hover:text-black transition-colors p-1 rounded hover:bg-gray-100"
          >
            <X className="w-5 h-5" />
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

          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              배너 표시 모드
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, display_mode: 'default' }))}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  formData.display_mode === 'default'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-5 rounded border border-gray-300 bg-gray-100 flex">
                    <div className="w-1/2 flex items-center justify-center text-[6px] text-gray-400">
                      T
                    </div>
                    <div className="w-1/2 bg-gray-300 rounded-r" />
                  </div>
                  <span className="text-sm font-semibold text-gray-800">기본형</span>
                </div>
                <p className="text-[10px] text-gray-500">텍스트 + 이미지 분리 레이아웃</p>
              </button>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, display_mode: 'fullpage' }))}
                className={`p-3 rounded-lg border-2 text-left transition-all ${
                  formData.display_mode === 'fullpage'
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-5 rounded border border-gray-300 bg-gray-400 flex items-center justify-center text-[6px] text-white font-bold">
                    FULL
                  </div>
                  <span className="text-sm font-semibold text-gray-800">풀페이지</span>
                </div>
                <p className="text-[10px] text-gray-500">이미지 전체 배너 (텍스트 오버레이)</p>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              슬라이드 이미지 — PC (가로형, 필수)
            </label>
            {/* 권장 해상도 안내. 메인 배너 (HeroSlider) 가 lg:h-[1000px]
                까지 늘어나기 때문에, 세로 픽셀이 모자란 소스 (예: 2400×800)
                는 데스크탑에서 25% 이상 업스케일되며 흐릿하게 보입니다.
                2400×1200(2:1) 이상이 가장 안전합니다. */}
            <p className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1.5">
              <strong className="font-bold">권장 해상도</strong> · 2400 × 1200 px (2:1) 이상 · 가로폭은 1920 px 이상이면 OK · 세로폭이 1000 px 미만이면 큰 화면에서 흐릿하게 보일 수 있습니다.
            </p>
            <div
              className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer group ${
                previewUrl ? 'border-gray-200' : 'border-gray-200 hover:border-gray-400'
              }`}
              onClick={() => fileInputRef.current?.click()}
            >
              {previewUrl ? (
                <div className="relative">
                  {formData.media_type === 'video' ? (
                    <video
                      src={previewUrl}
                      autoPlay
                      muted
                      loop
                      playsInline
                      className="w-full h-44 object-contain rounded-xl bg-gray-50"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={previewUrl}
                      alt="미리보기"
                      className="w-full h-44 object-contain rounded-xl bg-gray-50"
                    />
                  )}
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
                      <div className="text-sm text-gray-700 font-semibold animate-pulse">
                        업로드 중...
                      </div>
                    </div>
                  )}
                  {uploadProgress === 'done' && (
                    <div className="absolute bottom-2 left-2 bg-green-600 text-white text-[10px] font-bold px-2 py-1 rounded-md">
                      업로드 완료
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-36 flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-600 transition-colors">
                  <Upload className="w-8 h-8 mb-2" />
                  <p className="text-sm font-semibold">클릭하여 이미지 업로드</p>
                  <p className="text-xs mt-1">JPG, PNG, WEBP, GIF, MP4 — 최대 20MB</p>
                  <p className="text-[11px] text-gray-400 mt-2 leading-relaxed">
                    권장: <strong className="font-semibold">데스크탑 2400×1500px (16:10) 이상</strong>, 가급적 원본 화질로 업로드해주세요.<br />
                    출시 시 자동으로 화면 크기에 맞춰 최적화되며 품질은 95%로 유지됩니다.
                  </p>
                </div>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif,video/mp4,video/webm"
              className="hidden"
              onChange={handleFileSelect}
            />
            {!formData.imageFile && (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-[10px] text-gray-400 font-semibold">
                    또는 URL 직접 입력
                  </span>
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

          {/* Migration 35 — optional mobile-specific composition. If the
              admin leaves this empty, HeroSlider falls back to the
              desktop image at every breakpoint, matching pre-2026-06-10
              behavior on rows from before this PR. */}
          <div className="space-y-2">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              슬라이드 이미지 — 모바일 (세로형, 선택)
            </label>
            <p className="text-[10px] text-blue-700 bg-blue-50 border border-blue-200 rounded px-2 py-1.5">
              모바일 전용 이미지를 업로드하면 작은 화면에서 자동으로 이 이미지가 표시됩니다. <strong>비워두면 PC 이미지를 그대로 사용</strong>합니다. 권장: 1200 × 1500 px (4:5) 또는 1080 × 1920 px (9:16).
            </p>
            <div
              className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer group ${
                mobilePreviewUrl ? 'border-gray-200' : 'border-gray-200 hover:border-gray-400'
              }`}
              onClick={() => mobileFileInputRef.current?.click()}
            >
              {mobilePreviewUrl ? (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={mobilePreviewUrl}
                    alt="모바일 미리보기"
                    className="w-full h-44 object-contain rounded-xl bg-gray-50"
                  />
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      setMobilePreviewUrl('');
                      setFormData(prev => ({ ...prev, mobileImageFile: null, mobileImageUrl: '' }));
                      if (mobileFileInputRef.current) mobileFileInputRef.current.value = '';
                    }}
                    className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ) : (
                <div className="h-28 flex flex-col items-center justify-center text-gray-400 group-hover:text-gray-600 transition-colors">
                  <Upload className="w-6 h-6 mb-1.5" />
                  <p className="text-xs font-semibold">클릭하여 모바일 이미지 업로드</p>
                  <p className="text-[10px] mt-0.5">선택 사항 — 비워두면 PC 이미지 사용</p>
                </div>
              )}
            </div>
            <input
              ref={mobileFileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              className="hidden"
              onChange={handleMobileFileSelect}
            />
            {!formData.mobileImageFile && (
              <>
                <div className="flex items-center gap-2 mt-2">
                  <div className="h-px flex-1 bg-gray-100" />
                  <span className="text-[10px] text-gray-400 font-semibold">또는 URL 직접 입력</span>
                  <div className="h-px flex-1 bg-gray-100" />
                </div>
                <input
                  type="url"
                  value={formData.mobileImageUrl}
                  onChange={e => {
                    setFormData(prev => ({ ...prev, mobileImageUrl: e.target.value }));
                    setMobilePreviewUrl(e.target.value);
                  }}
                  placeholder="https://example.com/mobile.jpg"
                  className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                />
              </>
            )}
          </div>

          <div>
            <div className="flex gap-1 mb-4">
              {SUPPORTED_LANGS.map(l => (
                <button
                  key={l}
                  type="button"
                  onClick={() => setActiveLang(l)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded transition-colors ${
                    activeLang === l
                      ? 'bg-black text-white'
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {LANG_LABELS[l]}
                  {(formData.badge[l] || formData.title[l]) && (
                    <span className="ml-1 w-1.5 h-1.5 bg-green-400 rounded-full inline-block" />
                  )}
                </button>
              ))}
            </div>

            <div className="space-y-1 mb-4">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                뱃지 ({LANG_LABELS[activeLang as keyof typeof LANG_LABELS]})
              </label>
              <input
                type="text"
                value={formData.badge[activeLang] || ''}
                onChange={e => updateField('badge', activeLang, e.target.value)}
                placeholder={activeLang === 'kr' ? '수분천재 크림' : 'Moisture Cream'}
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              />
            </div>

            <div className="space-y-1 mb-4">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                제목 ({LANG_LABELS[activeLang as keyof typeof LANG_LABELS]}){' '}
                {activeLang === 'kr' && '*'}
              </label>
              <textarea
                required={activeLang === 'kr'}
                rows={3}
                value={formData.title[activeLang] || ''}
                onChange={e => updateField('title', activeLang, e.target.value)}
                placeholder={activeLang === 'kr' ? '강력한\n고보습 케어' : 'Intense\nMoisture Care'}
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none resize-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                부제목 ({LANG_LABELS[activeLang as keyof typeof LANG_LABELS]})
              </label>
              <input
                type="text"
                value={formData.subtitle[activeLang] || ''}
                onChange={e => updateField('subtitle', activeLang, e.target.value)}
                placeholder={
                  activeLang === 'kr'
                    ? '사계절 + 속수분 + 윤광 + 모공쫀쫀'
                    : 'All-season + Deep hydration + Glow'
                }
                className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              클릭 링크 URL (선택)
            </label>
            <input
              type="text"
              value={formData.link_url}
              onChange={e => setFormData(prev => ({ ...prev, link_url: e.target.value }))}
              placeholder="예: /kr/products 또는 https://example.com"
              className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
            />
            <p className="text-[10px] text-gray-400">
              입력하면 슬라이드 클릭 시 해당 링크로 이동합니다. 비워두면 클릭 비활성.
            </p>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
              색상 설정
            </p>
            <div className="grid grid-cols-2 gap-4">
              {(
                [
                  { key: 'bg_color', label: '배경색' },
                  { key: 'text_color', label: '제목·부제목 색상' },
                  { key: 'badge_bg_color', label: '뱃지 배경색' },
                  { key: 'badge_text_color', label: '뱃지 폰트 색상' },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <label className="text-[10px] font-semibold text-gray-500">{label}</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData[key]}
                      onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                      className="w-14 h-10 rounded border border-gray-200 cursor-pointer p-0"
                    />
                    <input
                      type="text"
                      value={formData[key]}
                      onChange={e => setFormData(prev => ({ ...prev, [key]: e.target.value }))}
                      className="flex-1 border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none font-mono"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-3 pt-2 border-t border-gray-100">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
                폰트 크기 조절
              </p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                기본 크기 대비 ± px 단위로 조정 (예: -4 = 작게, +4 = 크게). 미리보기는 데스크탑 기준
                실제 크기입니다.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              {(
                [
                  { key: 'badge', label: '뱃지', basePx: 12, sample: '뱃지' },
                  { key: 'title', label: '제목', basePx: 48, sample: '제목' },
                  { key: 'subtitle', label: '부제목', basePx: 16, sample: '부제목' },
                ] as const
              ).map(({ key, label, basePx, sample }) => {
                const offsetField = `${key}_size_offset` as
                  | 'badge_size_offset'
                  | 'title_size_offset'
                  | 'subtitle_size_offset';
                const offset = formData[offsetField] || 0;
                const effectivePx = basePx + offset;
                const sampleText = (formData[key][activeLang] || sample).split('\n')[0];
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <label className="text-[10px] font-semibold text-gray-500">{label}</label>
                      <span className="text-[10px] text-gray-400 font-mono">= {effectivePx}px</span>
                    </div>
                    <input
                      type="number"
                      value={offset}
                      onChange={e =>
                        setFormData(prev => ({
                          ...prev,
                          [offsetField]: parseInt(e.target.value) || 0,
                        }))
                      }
                      placeholder="0"
                      className="w-full border border-gray-200 p-2 text-sm rounded bg-gray-50 focus:bg-white focus:border-black transition outline-none"
                    />
                    <div
                      className="px-2 py-1.5 border border-gray-200 rounded bg-white overflow-hidden truncate"
                      style={{ fontSize: `${effectivePx}px`, lineHeight: 1.15 }}
                      title={sampleText}
                    >
                      {sampleText}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Phase 3 typography controls ─────────────────────────
              Same panel + position picker as the SubHero editor; admin
              gets per-block font, B/I/U and a single 9-cell anchor for
              where the text sits inside the slide. Colors stay in the
              existing "색상 설정" group above. */}
          <div className="space-y-4 pt-2 border-t border-gray-100">
            <div>
              <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">타이포그래피</p>
              <p className="text-[10px] text-gray-400 mt-0.5">
                폰트와 굵기 / 기울임 / 밑줄을 텍스트별로 지정하고, 텍스트 블록의 위치를 슬라이드 안에서 골라보세요.
              </p>
            </div>
            <TypographyPanel
              label="뱃지 스타일"
              value={{
                fontFamily: formData.badge_font_family,
                bold: formData.badge_bold,
                italic: formData.badge_italic,
                underline: formData.badge_underline,
                color: formData.badge_text_color,
              }}
              onChange={s => setFormData(prev => ({
                ...prev,
                badge_font_family: s.fontFamily,
                badge_bold: s.bold,
                badge_italic: s.italic,
                badge_underline: s.underline,
                badge_text_color: s.color ?? prev.badge_text_color,
              }))}
              defaultColor="#FFFFFF"
            />
            <TypographyPanel
              label="제목 스타일"
              value={{
                fontFamily: formData.title_font_family,
                bold: formData.title_bold,
                italic: formData.title_italic,
                underline: formData.title_underline,
                color: formData.text_color,
              }}
              onChange={s => setFormData(prev => ({
                ...prev,
                title_font_family: s.fontFamily,
                title_bold: s.bold,
                title_italic: s.italic,
                title_underline: s.underline,
                text_color: s.color ?? prev.text_color,
              }))}
              defaultColor="#111111"
            />
            <TypographyPanel
              label="부제목 스타일"
              value={{
                fontFamily: formData.subtitle_font_family,
                bold: formData.subtitle_bold,
                italic: formData.subtitle_italic,
                underline: formData.subtitle_underline,
                color: formData.text_color,
              }}
              onChange={s => setFormData(prev => ({
                ...prev,
                subtitle_font_family: s.fontFamily,
                subtitle_bold: s.bold,
                subtitle_italic: s.italic,
                subtitle_underline: s.underline,
                // text_color stays in the title panel since it controls
                // both rows on this table — passing hideColor below means
                // s.color is always the unchanged title color and this
                // assignment is a no-op, kept for shape parity only.
                text_color: s.color ?? prev.text_color,
              }))}
              defaultColor="#111111"
              hideColor
            />
            {/* Text position — continuous picker (migration 30). Admin
                clicks anywhere in the box to place text; PC and 모바일
                anchors stored separately because the product image
                often forces different layouts on each breakpoint. The
                preview image inside the picker is the same uploaded
                slide media so the admin aims relative to the actual
                photo, not a blank rectangle. */}
            <div>
              <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-1">텍스트 위치</p>
              <p className="text-[10px] text-gray-400 mb-2">
                미리보기에서 원하는 위치를 클릭하거나 흰 점을 드래그하세요. (PC와 모바일을 따로 설정)
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ContinuousPositionPicker
                  label="PC 텍스트 위치"
                  value={formData.text_anchor}
                  onChange={a => setFormData(prev => ({ ...prev, text_anchor: a }))}
                  aspectRatio="aspect-[16/7]"
                  backgroundImage={previewUrl || formData.imageUrl || undefined}
                />
                <ContinuousPositionPicker
                  label="모바일 텍스트 위치"
                  value={formData.text_anchor_mobile}
                  onChange={a => setFormData(prev => ({ ...prev, text_anchor_mobile: a }))}
                  aspectRatio="aspect-[9/14]"
                  backgroundImage={previewUrl || formData.imageUrl || undefined}
                />
              </div>
            </div>

            {/* Image focal point — same picker, but the anchor drives
                CSS object-position instead of text placement. Picking
                a point near a product feature pins that feature in
                view even when the wide-source image crops to portrait
                on mobile. */}
            <div>
              <p className="text-[11px] font-bold tracking-widest text-gray-500 uppercase mb-1">이미지 중심점</p>
              <p className="text-[10px] text-gray-400 mb-2">
                이미지가 잘릴 때 어느 지점을 중심으로 보일지 정합니다. 원하는 부분을 클릭하세요.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <ContinuousPositionPicker
                  label="PC 이미지 중심점"
                  value={formData.image_anchor}
                  onChange={a => setFormData(prev => ({ ...prev, image_anchor: a }))}
                  aspectRatio="aspect-[16/7]"
                  backgroundImage={previewUrl || formData.imageUrl || undefined}
                  markerColor="#facc15"
                />
                <ContinuousPositionPicker
                  label="모바일 이미지 중심점"
                  value={formData.image_anchor_mobile}
                  onChange={a => setFormData(prev => ({ ...prev, image_anchor_mobile: a }))}
                  aspectRatio="aspect-[9/14]"
                  backgroundImage={previewUrl || formData.imageUrl || undefined}
                  markerColor="#facc15"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-2 border-t border-gray-100">
            <div className="space-y-1">
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
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
              <label className="text-[11px] font-bold tracking-widest text-gray-500 uppercase">
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

          <div className="pt-4 border-t border-gray-100 flex justify-end gap-3">
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
