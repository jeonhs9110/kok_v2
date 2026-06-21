'use client';

import { Loader2 } from 'lucide-react';

interface Props {
  imageUrl: string;
  isUploading: boolean;
  fileRef: (el: HTMLInputElement | null) => void;
  onFile: (file: File) => void;
}

/**
 * Thumbnail + file picker row for ReviewCardEditor. Shows the current
 * image OR a "NO IMG" placeholder; the file picker drops the chosen file
 * straight back through onFile (the parent handles the supabase upload).
 */
export default function ReviewThumbnailRow({ imageUrl, isUploading, fileRef, onFile }: Props) {
  return (
    <div>
      <label className="text-[11px] font-semibold text-[#6b7280] uppercase tracking-wider">
        썸네일 이미지
      </label>
      <div className="flex gap-3 mt-1 items-start">
        {imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt=""
            className="w-24 h-24 object-cover rounded border border-[#e5e7eb]"
          />
        ) : (
          <div className="w-24 h-24 bg-[#f3f4f6] rounded border border-[#e5e7eb] flex items-center justify-center text-[10px] text-[#9ca3af]">
            NO IMG
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={e => {
              const f = e.target.files?.[0];
              if (f) onFile(f);
            }}
            className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-[#f3f4f6] file:text-[#374151] hover:file:bg-[#e5e7eb]"
          />
          {isUploading && (
            <p className="text-[11px] text-[#3b82f6] flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> 업로드 중...
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
