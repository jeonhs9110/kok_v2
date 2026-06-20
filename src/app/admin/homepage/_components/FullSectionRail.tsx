'use client';

import Link from 'next/link';
import { Plus, Code2 } from 'lucide-react';
import { LoadingState } from '@/components/admin/CafeWidgets';
import SectionCard, { type SectionDef } from './SectionCard';

/**
 * Default left rail for /admin/homepage — tab strip (섹션 / 스타일 /
 * 확장), scrollable section list with reorderable cards + an "Add 띠배너"
 * shortcut in the section group, footer with "Add section (Page builder)"
 * and "Edit theme HTML" deep-links.
 *
 * Pure props in / callbacks out — the parent owns reorder state,
 * selection state, drawer open/close, and the banner-add handler.
 * Extracted from /admin/homepage/page.tsx at 2026-06-21.
 */

interface Props {
  grouped: Array<{ title: string; sections: SectionDef[] }>;
  isLoading: boolean;
  selectedKey: string;
  dragOverKey: string | null;
  onSelect: (key: string) => void;
  onEdit: (key: string) => void;
  onAddBanner: () => void;
  /** Returns true when the given section can be reordered. The full rail
   *  only attaches drag handlers when this returns true so non-orderable
   *  cards (e.g. footer) don't accept drops. */
  isReorderable: (key: string) => boolean;
  onDragStart: (key: string, e: React.DragEvent) => void;
  onDragOver: (key: string, e: React.DragEvent) => void;
  onDrop: (key: string, e: React.DragEvent) => void;
  onDragEnd: () => void;
}

export default function FullSectionRail({
  grouped,
  isLoading,
  selectedKey,
  dragOverKey,
  onSelect,
  onEdit,
  onAddBanner,
  isReorderable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: Props) {
  return (
    <aside className="w-[320px] bg-white border-r border-[#e5e7eb] flex flex-col overflow-hidden flex-shrink-0">
      <div className="flex border-b border-[#e5e7eb] bg-[#f9fafb]">
        <TabButton active>섹션</TabButton>
        <TabButton href="/admin/theme?from=homepage">스타일</TabButton>
        <TabButton disabled>확장</TabButton>
      </div>

      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-4">
        {isLoading ? (
          <LoadingState />
        ) : (
          grouped.map(group => (
            <div key={group.title}>
              <div className="flex items-center justify-between px-1 pb-2">
                <p className="text-[10px] font-bold tracking-[0.15em] uppercase text-[#9ca3af]">
                  {group.title}
                </p>
                {group.title === '홈페이지 섹션 (위에서 아래로)' && (
                  <button
                    type="button"
                    onClick={onAddBanner}
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-semibold text-[#3b82f6] hover:bg-[#eff6ff] rounded transition-colors"
                    title="섹션 사이에 띠배너 추가"
                  >
                    <Plus className="w-3 h-3" />
                    띠배너
                  </button>
                )}
              </div>
              <div className="space-y-1.5">
                {group.sections.map(section => {
                  const reorderable = isReorderable(section.key);
                  return (
                    <SectionCard
                      key={section.key}
                      section={section}
                      selected={selectedKey === section.key}
                      onSelect={() => onSelect(section.key)}
                      onEdit={() => onEdit(section.key)}
                      draggable={reorderable}
                      onDragStart={reorderable ? e => onDragStart(section.key, e) : undefined}
                      onDragOver={reorderable ? e => onDragOver(section.key, e) : undefined}
                      onDrop={reorderable ? e => onDrop(section.key, e) : undefined}
                      onDragEnd={reorderable ? onDragEnd : undefined}
                      dragOver={dragOverKey === section.key}
                    />
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>

      <div className="border-t border-[#e5e7eb] p-3 space-y-2 bg-[#fafbfc] flex-shrink-0">
        <Link
          href="/admin/pages?from=homepage"
          className="flex items-center justify-center gap-1.5 w-full px-3 py-2 text-[12px] font-semibold text-[#3b82f6] border border-[#bfdbfe] bg-white rounded hover:bg-[#eff6ff] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          섹션 추가 (페이지 빌더)
        </Link>
        <Link
          href="/admin/theme?from=homepage"
          className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-[11px] text-[#6b7280] hover:text-[#1f2937] transition-colors"
        >
          <Code2 className="w-3 h-3" />
          테마/HTML 직접 편집
        </Link>
      </div>
    </aside>
  );
}

/** Tab button used by the rail's top tab strip. Local — only used here. */
function TabButton({
  children,
  active = false,
  disabled = false,
  href,
}: {
  children: React.ReactNode;
  active?: boolean;
  disabled?: boolean;
  href?: string;
}) {
  const base = `flex-1 py-2.5 text-[12px] font-semibold transition-colors border-b-2 ${
    active
      ? 'border-[#3b82f6] text-[#3b82f6] bg-white'
      : disabled
      ? 'border-transparent text-[#d1d5db] cursor-not-allowed'
      : 'border-transparent text-[#6b7280] hover:text-[#1f2937] hover:bg-white'
  }`;
  if (href && !disabled) {
    return (
      <Link href={href} className={base}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={base} disabled={disabled}>
      {children}
    </button>
  );
}
