'use client';

import Image from 'next/image';
import { Upload, Trash2, Link as LinkIcon, ImageIcon } from 'lucide-react';

export interface PromoBanner {
  id: string;
  image_url: string;
  link_url: string;
  sort_order: number;
  is_active: boolean;
}

interface Props {
  banner: PromoBanner;
  index: number;
  uploadingSlot: string | null;
  saving: string | null;
  onPickFile: () => void;
  onUrlChange: (url: string) => void;
  onLinkChange: (link: string) => void;
  onSave: () => void;
  onDelete: () => void;
}

export default function PromoBannerSlot({
  banner,
  index,
  uploadingSlot,
  saving,
  onPickFile,
  onUrlChange,
  onLinkChange,
  onSave,
  onDelete,
}: Props) {
  return (
    <div className="bg-white rounded border border-[#e5e7eb] overflow-hidden">
      <div className="p-3 border-b border-[#e5e7eb] bg-[#fafbfc] flex items-center justify-between">
        <span className="text-sm font-bold text-[#374151]">배너 {index + 1}</span>
        {banner.image_url && (
          <button
            onClick={onDelete}
            className="text-[#ef4444]/70 hover:text-[#ef4444] transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      <div
        className="relative aspect-square bg-[#fafbfc] flex items-center justify-center cursor-pointer group border-2 border-dashed border-[#e5e7eb] hover:border-[#9ca3af] transition-colors m-4 rounded-lg overflow-hidden kokkok-keep-border"
        onClick={onPickFile}
      >
        {banner.image_url ? (
          <>
            <Image src={banner.image_url} alt="" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
              <Upload className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center gap-2 text-[#9ca3af] group-hover:text-[#6b7280] transition-colors">
            {uploadingSlot === banner.id ? (
              <div className="w-8 h-8 border-2 border-[#9ca3af] border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <ImageIcon className="w-8 h-8" />
                <span className="text-xs font-semibold">클릭하여 이미지 업로드</span>
              </>
            )}
          </div>
        )}
      </div>

      <div className="px-4 pb-2">
        <div className="flex items-center gap-2 text-[10px] text-[#9ca3af] mb-2">
          <div className="h-px flex-1 bg-[#f3f4f6]" />
          <span className="font-semibold">또는 URL 직접 입력</span>
          <div className="h-px flex-1 bg-[#f3f4f6]" />
        </div>
        <input
          type="url"
          value={banner.image_url}
          onChange={e => onUrlChange(e.target.value)}
          placeholder="https://..."
          className="w-full rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="px-4 pb-4 space-y-1">
        <label className="text-[10px] font-bold tracking-widest text-[#6b7280] uppercase flex items-center gap-1">
          <LinkIcon className="w-3 h-3" /> 클릭 링크 URL
        </label>
        <input
          type="text"
          value={banner.link_url}
          onChange={e => onLinkChange(e.target.value)}
          placeholder="https://example.com 또는 /kr/products"
          className="w-full rounded px-3 py-2 text-sm"
        />
      </div>

      <div className="px-4 pb-4">
        <button
          onClick={onSave}
          disabled={saving === banner.id || !banner.image_url}
          className="w-full bg-[#3b82f6] text-white py-2.5 rounded text-sm font-bold tracking-widest hover:bg-[#2563eb] transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {saving === banner.id ? (
            <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> 저장 중...</>
          ) : '저장'}
        </button>
      </div>
    </div>
  );
}
