'use client';

import { type CSSProperties, type ReactNode, useId } from 'react';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/**
 * Thin wrapper around dnd-kit/sortable for the common admin pattern:
 *
 *   <SortableList
 *     items={rows}
 *     getId={r => r.id}
 *     onReorder={next => setRows(next)}      // local state
 *     onPersist={async next => { ... }}      // optional DB write
 *   >
 *     {(row, { dragHandleProps }) => (
 *       <div className="...">
 *         <button {...dragHandleProps}><GripVertical /></button>
 *         <span>{row.name}</span>
 *       </div>
 *     )}
 *   </SortableList>
 *
 * Consumers pick where to render the drag handle by spreading
 * `dragHandleProps`. Everything else (drag overlay, animations,
 * keyboard support) is handled here. Keeps the DnD boilerplate out
 * of every admin page that needs reorder.
 */

// Spreadable props for the drag handle element. Includes the dnd-kit
// pointer/keyboard listeners and the activator ref, plus a default
// aria-label + cursor classNames that consumers can override.
type DragHandleProps = Record<string, unknown> & {
  ref: ReturnType<typeof useSortable>['setActivatorNodeRef'];
  'aria-label'?: string;
  className?: string;
};

interface Props<T> {
  items: T[];
  getId: (item: T) => string;
  onReorder: (next: T[]) => void;
  /**
   * Called after a successful drag with the new array — typically used
   * to persist `sort_order` back to the DB. Local order has already been
   * updated via `onReorder`; this is for the side-effect.
   */
  onPersist?: (next: T[]) => void | Promise<void>;
  children: (item: T, helpers: { dragHandleProps: DragHandleProps }) => ReactNode;
  className?: string;
}

export default function SortableList<T>({
  items,
  getId,
  onReorder,
  onPersist,
  children,
  className,
}: Props<T>) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const oldIndex = items.findIndex((i) => getId(i) === active.id);
    const newIndex = items.findIndex((i) => getId(i) === over.id);
    if (oldIndex === -1 || newIndex === -1) return;
    const next = arrayMove(items, oldIndex, newIndex);
    onReorder(next);
    if (onPersist) void onPersist(next);
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={items.map(getId)} strategy={verticalListSortingStrategy}>
        <div className={className}>
          {items.map((item) => (
            <SortableRow key={getId(item)} id={getId(item)}>
              {(helpers) => children(item, helpers)}
            </SortableRow>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

function SortableRow({
  id,
  children,
}: {
  id: string;
  children: (helpers: { dragHandleProps: DragHandleProps }) => ReactNode;
}) {
  const handleId = useId();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    cursor: isDragging ? 'grabbing' : undefined,
    zIndex: isDragging ? 10 : undefined,
    position: 'relative',
  };

  const dragHandleProps: DragHandleProps = {
    ...(listeners ?? {}),
    ref: setActivatorNodeRef,
    'aria-label': '드래그하여 순서 변경',
    className: 'cursor-grab active:cursor-grabbing touch-none',
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes} aria-describedby={handleId}>
      {children({ dragHandleProps })}
    </div>
  );
}
