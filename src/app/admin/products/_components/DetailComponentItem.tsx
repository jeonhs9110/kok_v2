'use client';

import { GripVertical, Trash2, Film, Image as ImgIcon } from 'lucide-react';
import { toYouTubeThumbnailUrl, isYouTubeShortsUrl } from '@/lib/youtube';
import { type DetailComponent } from '@/lib/api/products';
import { YtIcon } from './productDetailHelpers';

interface DragHandleProps {
  className?: string;
  [key: string]: unknown;
}

interface Props {
  component: DetailComponent;
  index: number;
  dragHandleProps: DragHandleProps;
  onRemove: (id: string) => void;
}

/**
 * One row in the structured-component editor's SortableList. Picks the
 * right type icon + colored badge + thumbnail based on c.type (image /
 * video / youtube), shows the Shorts badge for vertical YouTube URLs,
 * and drops the remove + drag handle actions on the ends.
 */
export default function DetailComponentItem({ component: c, index: i, dragHandleProps, onRemove }: Props) {
  const TypeIcon = c.type === 'youtube' ? YtIcon : c.type === 'video' ? Film : ImgIcon;
  const typeBadge = c.type === 'youtube' ? 'YouTube' : c.type === 'video' ? '영상' : '이미지';
  const badgeColor =
    c.type === 'youtube' ? 'bg-[#fef2f2] text-[#b91c1c]' :
    c.type === 'video' ? 'bg-[#faf5ff] text-[#7c3aed]' :
    'bg-[#eff6ff] text-[#1d4ed8]';
  const thumbnail = c.type === 'youtube' ? toYouTubeThumbnailUrl(c.url) : c.type === 'image' ? c.url : '';

  return (
    <div className="border border-[#e5e7eb] rounded-lg p-3 flex gap-3 items-center bg-white">
      <button
        type="button"
        {...dragHandleProps}
        className={`${dragHandleProps.className ?? ''} text-[#d1d5db] hover:text-[#6b7280] p-1`}
        aria-label="드래그하여 순서 변경"
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="text-[10px] font-bold text-[#9ca3af] w-5 text-center select-none">{i + 1}</div>
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
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded ${badgeColor}`}>
            <TypeIcon className="w-3 h-3" />
            {typeBadge}
          </span>
          {c.type === 'youtube' && isYouTubeShortsUrl(c.url) && (
            <span className="px-1.5 py-0.5 bg-[#fff7ed] text-[#c2410c] text-[9px] font-bold rounded">Shorts</span>
          )}
        </div>
        <p className="text-[11px] text-[#6b7280] truncate" title={c.url}>{c.url}</p>
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
}
