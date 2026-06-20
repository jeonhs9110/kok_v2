'use client';

import { useRef } from 'react';
import { Upload, X } from 'lucide-react';

/**
 * Dashed-border dropzone with file picker, preview, clear button, and
 * fallback URL input — used for both the PC and mobile slide image
 * fields in the carousel modal. The PC variant accepts video + tracks
 * an upload-progress state; the mobile variant is image-only with a
 * smaller empty state. Both share the same chrome and clear behavior.
 *
 * Extracted from CarouselSlideModal at 2026-06-21 as part of the
 * 927-LOC modal split.
 */

interface Props {
  label: string;
  /** Yellow/blue tip block above the dropzone — exact copy varies per
   *  field, so the parent passes it as a React node. */
  tip: React.ReactNode;
  /** Live preview URL (object URL or persisted https URL). */
  previewUrl: string;
  /** The formData URL string — used by the "URL 직접 입력" fallback. */
  urlValue: string;
  /** Whether the current preview is a video (drives the <video> branch). */
  isVideo?: boolean;
  /** Whether a local File is present — hides the URL fallback while one
   *  is selected so the operator doesn't accidentally point at two
   *  sources. */
  hasFile: boolean;
  /** PC variant overlays an "업로드 중..." / "업로드 완료" badge over the
   *  preview. Mobile passes undefined to opt out. */
  uploadProgress?: 'idle' | 'uploading' | 'done' | 'error';
  /** Comma-separated accept attribute for the hidden <input type=file>. */
  accept: string;
  /** Empty-state visuals. */
  emptyTitle: string;
  emptySubtitle: string;
  emptyHint?: React.ReactNode;
  emptyHeight: 'h-36' | 'h-28';
  iconSize: 'w-8 h-8' | 'w-6 h-6';
  /** URL fallback input placeholder. */
  urlPlaceholder: string;

  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUrlChange: (url: string) => void;
  onClear: () => void;
}

export default function SlideImageUpload({
  label,
  tip,
  previewUrl,
  urlValue,
  isVideo = false,
  hasFile,
  uploadProgress,
  accept,
  emptyTitle,
  emptySubtitle,
  emptyHint,
  emptyHeight,
  iconSize,
  urlPlaceholder,
  onFileSelect,
  onUrlChange,
  onClear,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewMediaClass = 'w-full h-44 object-contain rounded-xl bg-[#fafbfc]';

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
        {label}
      </label>
      {tip}
      <div
        className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer group ${
          previewUrl ? 'border-[#e5e7eb]' : 'border-[#e5e7eb] hover:border-[#9ca3af]'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        {previewUrl ? (
          <div className="relative">
            {isVideo ? (
              <video
                src={previewUrl}
                autoPlay
                muted
                loop
                playsInline
                className={previewMediaClass}
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={previewUrl} alt={label} className={previewMediaClass} />
            )}
            <button
              type="button"
              onClick={e => {
                e.stopPropagation();
                onClear();
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              className="absolute top-2 right-2 bg-black/60 text-white rounded-full p-1 hover:bg-black transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            {uploadProgress === 'uploading' && (
              <div className="absolute inset-0 bg-white/70 rounded-xl flex items-center justify-center">
                <div className="text-sm text-[#374151] font-semibold animate-pulse">
                  업로드 중...
                </div>
              </div>
            )}
            {uploadProgress === 'done' && (
              <div className="absolute bottom-2 left-2 bg-[#16a34a] text-white text-[10px] font-bold px-2 py-1 rounded">
                업로드 완료
              </div>
            )}
          </div>
        ) : (
          <div
            className={`${emptyHeight} flex flex-col items-center justify-center text-[#9ca3af] group-hover:text-[#6b7280] transition-colors px-4`}
          >
            <Upload className={`${iconSize} mb-2`} />
            <p className="text-sm font-semibold">{emptyTitle}</p>
            <p className="text-xs mt-1">{emptySubtitle}</p>
            {emptyHint}
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={onFileSelect}
      />
      {!hasFile && (
        <>
          <div className="flex items-center gap-2 mt-2">
            <div className="h-px flex-1 bg-[#f3f4f6]" />
            <span className="text-[10px] text-[#9ca3af] font-semibold">또는 URL 직접 입력</span>
            <div className="h-px flex-1 bg-[#f3f4f6]" />
          </div>
          <input
            type="url"
            value={urlValue}
            onChange={e => onUrlChange(e.target.value)}
            placeholder={urlPlaceholder}
            className="w-full rounded px-3 py-2 text-sm"
          />
        </>
      )}
    </div>
  );
}
