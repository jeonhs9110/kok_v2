'use client';

import { useRef } from 'react';
import Image from 'next/image';
import { Upload, ImageIcon } from 'lucide-react';

/**
 * Image upload zone for the sub-hero editor — full-width dashed
 * dropzone that doubles as preview (image fills the box, hover shows
 * the upload affordance) plus a URL fallback input underneath.
 *
 * Extracted from /admin/sub-hero/page.tsx at 2026-06-21.
 */

interface Props {
  imageUrl: string;
  isUploading: boolean;
  onPickFile: (file: File) => Promise<void>;
  onUrlChange: (url: string) => void;
}

export default function SubHeroImageUpload({
  imageUrl,
  isUploading,
  onPickFile,
  onUrlChange,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase block mb-2">
        배너 이미지
      </label>
      <div
        className="relative w-full h-52 rounded-xl overflow-hidden border-2 border-dashed border-[#e5e7eb] hover:border-[#9ca3af] transition-colors cursor-pointer group bg-[#fafbfc] flex items-center justify-center"
        onClick={() => fileInputRef.current?.click()}
      >
        {imageUrl ? (
          <>
            <Image src={imageUrl} alt="" fill sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <Upload className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#9ca3af] group-hover:text-[#6b7280] transition-colors">
            {isUploading ? (
              <div className="w-8 h-8 border-2 border-[#9ca3af] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-8 h-8" />
                <span className="text-xs font-semibold">클릭하여 이미지 업로드</span>
                <span className="text-xs text-[#9ca3af]">권장 비율: 16:9 또는 21:9 (와이드)</span>
              </>
            )}
          </div>
        )}
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="hidden"
        onChange={async e => {
          const file = e.target.files?.[0];
          if (!file) return;
          await onPickFile(file);
          e.target.value = '';
        }}
      />
      <div className="mt-2">
        <input
          type="url"
          value={imageUrl}
          onChange={e => onUrlChange(e.target.value)}
          placeholder="또는 이미지 URL 직접 입력"
          className="w-full rounded px-3 py-2 text-sm"
        />
      </div>
    </div>
  );
}
