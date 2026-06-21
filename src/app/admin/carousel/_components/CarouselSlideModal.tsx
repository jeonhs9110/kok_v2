'use client';

import { X } from 'lucide-react';
import { type SlideFormData } from '../_lib';
import { useModalA11y } from '@/hooks/useModalA11y';
import CarouselSlidePreview from './CarouselSlidePreview';
import SlideDisplayModePicker from './SlideDisplayModePicker';
import SlideTextEditor from './SlideTextEditor';
import SlideColorPicker from './SlideColorPicker';
import SlideFontSizeOffsets from './SlideFontSizeOffsets';
import SlideTypographyAndPosition from './SlideTypographyAndPosition';
import SlideImagesSection from './SlideImagesSection';
import { useSlideLivePreview } from './useSlideLivePreview';
import { useSlideForm } from './useSlideForm';

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
  const f = useSlideForm(editingId, initialForm, initialPreviewUrl, onSaved);
  const dialogRef = useModalA11y(true, onClose);

  // Live preview broadcast to the homepage hub's central 1440px iframe.
  useSlideLivePreview(f.formData, editingId);

  return (
    <div className={f.isEmbedded
      ? 'fixed inset-0 z-50 flex items-stretch justify-stretch bg-white'
      : 'fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in duration-200'
    }>
      {/* In embedded mode the modal fills the drawer pane — no backdrop,
          no rounded card, no max-width clamp. Outside embedded mode it
          stays the classic centered modal card with backdrop. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="carousel-slide-modal-title"
        className={f.isEmbedded
          ? 'bg-white overflow-hidden flex flex-col w-full h-full'
          : 'bg-white rounded-xl shadow-2xl w-full max-w-5xl overflow-hidden flex flex-col max-h-[92vh]'
        }
      >
        <div className="p-4 border-b border-[#e5e7eb] flex justify-between items-center bg-[#fafbfc]">
          <h3 id="carousel-slide-modal-title" className="text-[14px] font-bold text-[#1f2937]">
            {editingId ? '슬라이드 수정' : '새 슬라이드 추가'}
          </h3>
          <button
            onClick={onClose}
            className="text-[#9ca3af] hover:text-[#1f2937] p-1 rounded hover:bg-[#f3f4f6] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={f.handleSubmit} className="overflow-y-auto">
          {/* Two-column layout: form left, sticky live preview right
              (lg+). In embedded mode collapse to single column — the
              central 1440px iframe is the canonical preview instead. */}
          <div className={f.isEmbedded
            ? 'p-6 space-y-5'
            : 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-6 p-6'
          }>
            <div className="space-y-5 min-w-0">
              {!f.isEmbedded && (
                <CarouselSlidePreview form={f.formData} lang={f.activeLang} previewImageUrl={f.previewUrl} />
              )}

              <SlideDisplayModePicker
                value={f.formData.display_mode as 'default' | 'fullpage'}
                onChange={mode => f.setFormData(prev => ({ ...prev, display_mode: mode }))}
              />

              <SlideImagesSection
                formData={f.formData}
                previewUrl={f.previewUrl}
                mobilePreviewUrl={f.mobilePreviewUrl}
                uploadProgress={f.uploadProgress}
                onDesktopFileSelect={f.handleFileSelect}
                onDesktopUrlChange={url => {
                  f.setFormData(prev => ({ ...prev, imageUrl: url }));
                  f.setPreviewUrl(url);
                }}
                onDesktopClear={() => {
                  f.setPreviewUrl('');
                  f.setFormData(prev => ({ ...prev, imageFile: null, imageUrl: '' }));
                  f.setUploadProgress('idle');
                }}
                onMobileFileSelect={f.handleMobileFileSelect}
                onMobileUrlChange={url => {
                  f.setFormData(prev => ({ ...prev, mobileImageUrl: url }));
                  f.setMobilePreviewUrl(url);
                }}
                onMobileClear={() => {
                  f.setMobilePreviewUrl('');
                  f.setFormData(prev => ({ ...prev, mobileImageFile: null, mobileImageUrl: '' }));
                }}
              />

              <SlideTextEditor
                formData={f.formData}
                activeLang={f.activeLang}
                onChangeLang={f.setActiveLang}
                onUpdateField={f.updateField}
                onUpdateLink={url => f.setFormData(prev => ({ ...prev, link_url: url }))}
              />

              <SlideColorPicker
                formData={f.formData}
                onChange={(key, value) => f.setFormData(prev => ({ ...prev, [key]: value }))}
              />

              <SlideFontSizeOffsets
                formData={f.formData}
                activeLang={f.activeLang}
                onChange={(key, value) => f.setFormData(prev => ({ ...prev, [key]: value }))}
              />

              <SlideTypographyAndPosition
                formData={f.formData}
                previewUrl={f.previewUrl}
                onChange={patch => f.setFormData(prev => ({ ...prev, ...patch }))}
              />

              <div className="grid grid-cols-2 gap-4 pt-2 border-t border-[#f3f4f6]">
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
                    표시 순서
                  </label>
                  <input
                    type="number"
                    value={f.formData.sort_order}
                    onChange={e => f.setFormData(prev => ({ ...prev, sort_order: e.target.value }))}
                    className="w-full p-2 text-sm rounded"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
                    상태
                  </label>
                  <select
                    value={f.formData.is_active ? 'active' : 'inactive'}
                    onChange={e =>
                      f.setFormData(prev => ({ ...prev, is_active: e.target.value === 'active' }))
                    }
                    className="w-full p-2 text-sm rounded bg-white"
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
                  ) : editingId ? (
                    '수정 저장'
                  ) : (
                    '슬라이드 저장'
                  )}
                </button>
              </div>
            </div>

            {/* Sticky live preview — stays in view as the admin scrolls. */}
            {!f.isEmbedded && (
              <aside className="lg:sticky lg:top-0 lg:self-start">
                <CarouselSlidePreview
                  form={f.formData}
                  lang={f.activeLang}
                  previewImageUrl={f.previewUrl}
                  previewMobileImageUrl={f.mobilePreviewUrl}
                />
              </aside>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}
