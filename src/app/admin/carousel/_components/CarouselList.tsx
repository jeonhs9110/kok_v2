'use client';

import {
  Trash2,
  ImageIcon,
  Pencil,
  GripVertical,
  Link as LinkIcon,
} from 'lucide-react';
import type { CarouselSlide } from '@/lib/api/carousel';
import SortableList from '@/components/admin/SortableList';
import { EmptyState, LoadingState } from '@/components/admin/CafeWidgets';

interface Props {
  slides: CarouselSlide[];
  isLoading: boolean;
  onEdit: (slide: CarouselSlide) => void;
  onDelete: (id: string) => void;
  onToggleActive: (id: string, current: boolean) => void;
  /**
   * Called after a drag-to-reorder. Receives the slides in their new
   * order — the parent updates local state immediately and persists
   * the new sort_order values to the DB.
   */
  onReorder: (next: CarouselSlide[]) => void | Promise<void>;
}

export default function CarouselList({
  slides,
  isLoading,
  onEdit,
  onDelete,
  onToggleActive,
  onReorder,
}: Props) {
  if (isLoading) return <LoadingState />;
  if (slides.length === 0) return <EmptyState label="등록된 슬라이드가 없습니다 · 슬라이드 추가 버튼을 눌러 캐러셀을 구성하세요" />;

  return (
    <div className="p-4">
      <p className="text-[10px] text-gray-400 mb-3 ml-1 tracking-wider uppercase font-semibold">
        총 {slides.length}개 · 드래그하여 순서 변경
      </p>
      <SortableList
        items={slides}
        getId={(s) => s.id}
        onReorder={(next) => onReorder(next)}
        className="space-y-2"
      >
        {(s, { dragHandleProps }) => (
          <div
            className={`flex items-center gap-3 bg-white border border-gray-200 rounded-lg p-3 hover:border-gray-400 transition-colors ${
              !s.is_active ? 'opacity-60' : ''
            }`}
          >
            <button
              type="button"
              {...dragHandleProps}
              className={`${dragHandleProps.className ?? ''} text-gray-300 hover:text-gray-600 p-1`}
              aria-label="드래그하여 순서 변경"
            >
              <GripVertical className="w-5 h-5" />
            </button>

            <div className="flex-shrink-0 w-20 h-14 rounded overflow-hidden bg-gray-100 border border-gray-200">
              {s.image_url ? (
                s.media_type === 'video' ? (
                  <video src={s.image_url} muted className="w-full h-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={s.image_url} className="w-full h-full object-cover" alt="" />
                )
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-gray-300" />
                </div>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <span
                  className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                    s.display_mode === 'fullpage'
                      ? 'bg-purple-50 text-purple-700'
                      : 'bg-gray-100 text-gray-500'
                  }`}
                >
                  {s.display_mode === 'fullpage' ? '풀페이지' : '기본'}
                </span>
                {s.media_type && s.media_type !== 'image' && (
                  <span
                    className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      s.media_type === 'video'
                        ? 'bg-blue-50 text-blue-700'
                        : 'bg-orange-50 text-orange-700'
                    }`}
                  >
                    {s.media_type === 'video' ? 'MP4' : 'GIF'}
                  </span>
                )}
                {s.badge?.kr && (
                  <span className="text-[10px] text-gray-400 font-semibold">{s.badge.kr}</span>
                )}
              </div>
              <p className="text-sm font-bold text-gray-900 line-clamp-1">
                {(s.title?.kr || '제목 없음').replace(/\n/g, ' ')}
              </p>
              {s.subtitle?.kr && (
                <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{s.subtitle.kr}</p>
              )}
              {s.link_url && (
                <span className="inline-flex items-center gap-1 text-[10px] text-blue-500 mt-1">
                  <LinkIcon className="w-3 h-3" />
                  {s.link_url}
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              <div className="hidden sm:flex items-center gap-1.5">
                <div
                  className="w-5 h-5 rounded border border-gray-200"
                  style={{ backgroundColor: s.bg_color }}
                  title={s.bg_color}
                />
              </div>
              <button
                type="button"
                onClick={() => onToggleActive(s.id, s.is_active)}
                className={`inline-flex px-2 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase transition-colors ${
                  s.is_active
                    ? 'bg-green-50 text-green-700 hover:bg-green-100'
                    : 'bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
                }`}
              >
                {s.is_active ? '활성' : '비활성'}
              </button>
              <button
                type="button"
                onClick={() => onEdit(s)}
                className="text-gray-400 hover:text-blue-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100"
              >
                <Pencil className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => onDelete(s.id)}
                className="text-gray-400 hover:text-red-600 transition-colors bg-white p-1.5 rounded-md shadow-sm border border-gray-100"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </SortableList>
    </div>
  );
}
