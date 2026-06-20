'use client';

import { useRef } from 'react';
import { Upload, X } from 'lucide-react';

/**
 * Primary product image dropzone — dashed border, file picker, URL
 * fallback, clear button, upload progress overlay. Same shape as the
 * carousel modal's SlideImageUpload but with image-only accept and
 * smaller empty state. Extracted from ProductDetailModal at 2026-06-21.
 */

interface Props {
  previewUrl: string;
  urlValue: string;
  hasFile: boolean;
  uploadProgress: 'idle' | 'uploading' | 'done' | 'error';
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onUrlChange: (url: string) => void;
  onClear: () => void;
}

export default function ProductImageUpload({
  previewUrl,
  urlValue,
  hasFile,
  uploadProgress,
  onFileSelect,
  onUrlChange,
  onClear,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
        상품 이미지
      </label>
      <div
        className={`relative border-2 border-dashed rounded-xl transition-colors cursor-pointer group ${
          previewUrl ? 'border-[#e5e7eb]' : 'border-[#e5e7eb] hover:border-[#9ca3af]'
        }`}
        onClick={() => fileInputRef.current?.click()}
      >
        {previewUrl ? (
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="미리보기"
              className="w-full h-52 object-contain rounded-xl bg-[#fafbfc]"
            />
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
                ✓ 업로드 완료
              </div>
            )}
          </div>
        ) : (
          <div className="h-40 flex flex-col items-center justify-center text-[#9ca3af] group-hover:text-[#6b7280] transition-colors">
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
            placeholder="https://example.com/image.jpg"
            className="w-full rounded px-3 py-2 text-sm"
          />
        </>
      )}
    </div>
  );
}
