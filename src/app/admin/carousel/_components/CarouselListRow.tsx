'use client';

import {
  Trash2,
  ImageIcon,
  Pencil,
  GripVertical,
  Link as LinkIcon,
} from 'lucide-react';
import type { CarouselSlide } from '@/lib/api/carousel';

interface DragHandleProps {
  className?: string;
  [key: string]: unknown;
}

interface Props {
  s: CarouselSlide;
  dragHandleProps: DragHandleProps;
  onEdit: (slide: CarouselSlide) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, current: boolean) => void;
}

/**
 * One slide row in the carousel list. Renders the thumbnail (image /
 * video preview) + display-mode + media-type chips + title/subtitle/link
 * preview + bg color swatch + active toggle + edit/delete actions. Pure
 * UI; the parent's useCarousel handlers drive everything via callbacks.
 */
export default function CarouselListRow({ s, dragHandleProps, onEdit, onDelete, onToggleActive }: Props) {
  return (
    <div
      className={`flex items-center gap-3 bg-white border border-[#e5e7eb] rounded-lg p-3 hover:border-[#9ca3af] transition-colors ${
        !s.is_active ? 'opacity-60' : ''
      }`}
    >
      <button
        type="button"
        {...dragHandleProps}
        className={`${dragHandleProps.className ?? ''} text-[#d1d5db] hover:text-[#6b7280] p-1`}
        aria-label="드래그하여 순서 변경"
      >
        <GripVertical className="w-5 h-5" />
      </button>

      <div className="flex-shrink-0 w-20 h-14 rounded overflow-hidden bg-[#f3f4f6] border border-[#e5e7eb]">
        {s.image_url ? (
          s.media_type === 'video' ? (
            <video src={s.image_url} muted className="w-full h-full object-cover" />
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.image_url} className="w-full h-full object-cover" alt="" />
          )
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ImageIcon className="w-4 h-4 text-[#d1d5db]" />
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <span
            className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
              s.display_mode === 'fullpage'
                ? 'bg-[#faf5ff] text-[#7c3aed]'
                : 'bg-[#f3f4f6] text-[#6b7280]'
            }`}
          >
            {s.display_mode === 'fullpage' ? '풀페이지' : '기본'}
          </span>
          {s.media_type && s.media_type !== 'image' && (
            <span
              className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                s.media_type === 'video'
                  ? 'bg-[#eff6ff] text-[#1d4ed8]'
                  : 'bg-[#fff7ed] text-[#c2410c]'
              }`}
            >
              {s.media_type === 'video' ? 'MP4' : 'GIF'}
            </span>
          )}
          {s.badge?.kr && (
            <span className="text-[10px] text-[#9ca3af] font-semibold">{s.badge.kr}</span>
          )}
        </div>
        <p className="text-sm font-bold text-[#1f2937] line-clamp-1">
          {(s.title?.kr || '제목 없음').replace(/\n/g, ' ')}
        </p>
        {s.subtitle?.kr && (
          <p className="text-xs text-[#6b7280] mt-0.5 line-clamp-1">{s.subtitle.kr}</p>
        )}
        {s.link_url && (
          <span className="inline-flex items-center gap-1 text-[10px] text-[#3b82f6] mt-1">
            <LinkIcon className="w-3 h-3" />
            {s.link_url}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        <div className="hidden sm:flex items-center gap-1.5">
          <div
            className="w-5 h-5 rounded border border-[#e5e7eb]"
            style={{ backgroundColor: s.bg_color }}
            title={s.bg_color}
          />
        </div>
        <button
          type="button"
          onClick={() => onToggleActive(s.id, s.is_active)}
          className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors ${
            s.is_active
              ? 'bg-[#dcfce7] text-[#15803d] hover:bg-[#bbf7d0]'
              : 'bg-[#f3f4f6] text-[#6b7280] hover:bg-[#e5e7eb]'
          }`}
        >
          {s.is_active ? '활성' : '비활성'}
        </button>
        <button
          type="button"
          onClick={() => onEdit(s)}
          className="text-[#9ca3af] hover:text-[#3b82f6] transition-colors p-1.5 rounded hover:bg-[#f3f4f6]"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={() => onDelete(s.id)}
          className="text-[#9ca3af] hover:text-[#ef4444] transition-colors p-1.5 rounded hover:bg-[#f3f4f6]"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
