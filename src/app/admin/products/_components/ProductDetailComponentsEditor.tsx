'use client';

import {
  Upload, GripVertical, Trash2, Film, Image as ImgIcon, Eye,
} from 'lucide-react';
import { useRef } from 'react';
import { toYouTubeThumbnailUrl, isYouTubeShortsUrl } from '@/lib/youtube';
import type { DetailComponent } from '@/lib/api/products';
import SortableList from '@/components/admin/SortableList';
import ProductDetailComponents from '@/components/ProductDetailComponents';

/**
 * Detail-page block list editor for the product modal. Drag-orderable
 * components (image / video / youtube), an empty-state placeholder, a
 * live preview that pipes the same data through the storefront's real
 * ProductDetailComponents renderer, and a two-column "add a thing" row
 * (file picker + YouTube URL input + add button).
 *
 * Extracted from ProductDetailModal at 2026-06-21 as cut 2 of the
 * 762-LOC modal split. Parent owns formData + the upload / youtube
 * handlers; this child is pure UI.
 */

interface Props {
  components: DetailComponent[];
  onReorder: (next: DetailComponent[]) => void;
  onRemove: (id: string) => void;
  onFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
  isUploading: boolean;
  youtubeInput: string;
  youtubeError: string;
  onYoutubeInputChange: (value: string) => void;
  onAddYoutube: () => void;
}

/** Inline YouTube glyph — kept local since it's only used by this editor. */
function YtIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M23.5 6.2a3 3 0 00-2.1-2.1C19.5 3.6 12 3.6 12 3.6s-7.5 0-9.4.5A3 3 0 00.5 6.2C0 8.1 0 12 0 12s0 3.9.5 5.8a3 3 0 002.1 2.1c1.9.5 9.4.5 9.4.5s7.5 0 9.4-.5a3 3 0 002.1-2.1c.5-1.9.5-5.8.5-5.8s0-3.9-.5-5.8zM9.6 15.6V8.4l6.2 3.6-6.2 3.6z" />
    </svg>
  );
}

export default function ProductDetailComponentsEditor({
  components,
  onReorder,
  onRemove,
  onFileSelect,
  isUploading,
  youtubeInput,
  youtubeError,
  onYoutubeInputChange,
  onAddYoutube,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <label className="text-[11px] font-semibold tracking-wider text-[#6b7280] uppercase">
          상세페이지 컴포넌트
        </label>
        <span className="text-[10px] text-[#9ca3af]">
          위 → 아래 순서, 컴포넌트 간 마진 없이 이어붙음
        </span>
      </div>

      {components.length === 0 ? (
        <div className="border-2 border-dashed border-[#e5e7eb] rounded-xl p-6 text-center text-[#9ca3af] text-xs">
          아직 추가된 컴포넌트가 없습니다. 아래에서 이미지/영상/YouTube를 추가하세요.
        </div>
      ) : (
        <SortableList items={components} getId={c => c.id} onReorder={onReorder} className="space-y-2">
          {(c, { dragHandleProps }) => {
            const i = components.findIndex(x => x.id === c.id);
            const TypeIcon = c.type === 'youtube' ? YtIcon : c.type === 'video' ? Film : ImgIcon;
            const typeBadge = c.type === 'youtube' ? 'YouTube' : c.type === 'video' ? '영상' : '이미지';
            const badgeColor =
              c.type === 'youtube' ? 'bg-[#fef2f2] text-[#b91c1c]' :
              c.type === 'video' ? 'bg-[#f5f3ff] text-[#7c3aed]' :
              'bg-[#eff6ff] text-[#1d4ed8]';
            const thumbnail =
              c.type === 'youtube' ? toYouTubeThumbnailUrl(c.url) :
              c.type === 'image' ? c.url : '';
            return (
              <div className="border border-[#e5e7eb] rounded p-3 flex gap-3 items-center bg-white">
                <button
                  type="button"
                  {...dragHandleProps}
                  className={`${dragHandleProps.className ?? ''} text-[#d1d5db] hover:text-[#6b7280] p-1`}
                  aria-label="드래그하여 순서 변경"
                >
                  <GripVertical className="w-4 h-4" />
                </button>
                <div className="text-[10px] font-bold text-[#9ca3af] w-5 text-center select-none">
                  {i + 1}
                </div>
                <div className="w-20 h-14 bg-[#f3f4f6] rounded flex-shrink-0 overflow-hidden flex items-center justify-center">
                  {thumbnail ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={thumbnail} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Film className="w-6 h-6 text-[#9ca3af]" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1">
                    <span
                      className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded ${badgeColor}`}
                    >
                      <TypeIcon className="w-3 h-3" />
                      {typeBadge}
                    </span>
                    {c.type === 'youtube' && isYouTubeShortsUrl(c.url) && (
                      <span className="px-1.5 py-0.5 bg-[#fff7ed] text-[#c2410c] text-[9px] font-bold rounded">
                        Shorts
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-[#6b7280] truncate" title={c.url}>
                    {c.url}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onRemove(c.id)}
                  className="p-1.5 text-[#9ca3af] hover:text-[#ef4444]"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          }}
        </SortableList>
      )}

      {components.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#9ca3af]" />
            <p className="text-[10px] font-semibold tracking-wider text-[#6b7280] uppercase">
              사이트 미리보기
            </p>
            <span className="text-[10px] text-[#9ca3af] ml-auto">
              실제 스토어 페이지와 동일한 모습 (스토어 폭은 더 넓음)
            </span>
          </div>
          <div className="border border-[#e5e7eb] rounded overflow-hidden bg-white">
            <ProductDetailComponents components={components} />
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="border border-dashed border-[#d1d5db] rounded p-3 text-xs font-semibold text-[#374151] hover:border-[#3b82f6] hover:bg-[#fafbfc] transition disabled:opacity-50 flex items-center justify-center gap-2"
        >
          <Upload className="w-4 h-4" />
          {isUploading ? '업로드 중...' : '파일 업로드 (이미지/영상)'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4"
          className="hidden"
          onChange={onFileSelect}
        />
        <div className="border border-dashed border-[#d1d5db] rounded p-2 flex items-center gap-1.5">
          <YtIcon className="w-4 h-4 text-[#b91c1c] flex-shrink-0 ml-1" />
          <input
            type="url"
            value={youtubeInput}
            onChange={e => onYoutubeInputChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') {
                e.preventDefault();
                onAddYoutube();
              }
            }}
            placeholder="YouTube URL"
            className="flex-1 text-xs bg-transparent outline-none min-w-0 kokkok-keep-border kokkok-keep-focus"
          />
          <button
            type="button"
            onClick={onAddYoutube}
            className="px-2.5 py-1 bg-[#1f2937] text-white text-[11px] font-bold rounded hover:bg-[#111827]"
          >
            추가
          </button>
        </div>
      </div>
      {youtubeError && <p className="text-[10px] text-[#ef4444]">{youtubeError}</p>}
      <p className="text-[10px] text-[#9ca3af] leading-snug pt-1">
        이미지(PNG/JPG/WEBP/GIF), 영상(MP4), YouTube 링크를 추가하면 상세페이지 하단에 위→아래로
        마진 없이 이어붙어 표시됩니다. 영상 파일은{' '}
        <strong className="text-[#374151]">30MB 이하 권장</strong>. YouTube Shorts URL 사용 시
        자동으로 세로 비율(9:16)로 표시됩니다.
      </p>
    </div>
  );
}
