'use client';

import type { CarouselSlide } from '@/lib/api/carousel';
import SortableList from '@/components/admin/SortableList';
import { EmptyState, LoadingState } from '@/components/admin/CafeWidgets';
import CarouselListRow from './CarouselListRow';

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
      <p className="text-[10px] text-[#9ca3af] mb-3 ml-1 tracking-wider uppercase font-semibold">
        총 {slides.length}개 · 드래그하여 순서 변경
      </p>
      <SortableList
        items={slides}
        getId={(s) => s.id}
        onReorder={(next) => onReorder(next)}
        className="space-y-2"
      >
        {(s, { dragHandleProps }) => (
          <CarouselListRow
            s={s}
            dragHandleProps={dragHandleProps}
            onEdit={onEdit}
            onDelete={onDelete}
            onToggleActive={onToggleActive}
          />
        )}
      </SortableList>
    </div>
  );
}
