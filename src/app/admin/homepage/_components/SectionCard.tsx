'use client';

import { Pencil, Eye, EyeOff, GripVertical, ChevronRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * SectionCard — one row in the homepage builder's section list. Designed
 * to mirror Cafe24's section row pixel-by-pixel: drag handle, icon tile,
 * Korean name + status hint, visibility eye, and a chevron that doubles
 * as the edit affordance. Operator compared our admin to Cafe24's at
 * the 2026-06-10 meeting; matching this row shape closely is the single
 * highest-leverage UX change we ship.
 *
 * Visibility eye is read-only for Phase 1 MVP — it reflects whether the
 * section currently renders on the storefront (data present + active).
 * Toggle-to-hide writes land in Phase 1.5 once a per-section visibility
 * column is in place across the relevant config tables.
 */
export interface SectionDef {
  key: string;
  name: string;
  icon: LucideIcon;
  href: string;
  status: string;
  visible: boolean;
  hint?: string;
}

interface Props {
  section: SectionDef;
  selected: boolean;
  onSelect: () => void;
  onEdit: () => void;
  /** When true, the card is draggable to reorder the homepage section
   *  list. Site-chrome rows (theme, logo, menus, footer, top-stripe)
   *  pass false because the storefront's section order only covers the
   *  homepage body, not the global chrome. */
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  dragOver?: boolean;
}

export default function SectionCard({
  section, selected, onSelect, onEdit,
  draggable = false, onDragStart, onDragOver, onDrop, onDragEnd, dragOver = false,
}: Props) {
  const Icon = section.icon;
  return (
    <div
      onClick={onSelect}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      className={`group flex items-center gap-2 px-2.5 py-2 rounded-md border cursor-pointer transition-all relative ${
        selected
          ? 'border-[#3b82f6] bg-[#eff6ff] shadow-sm'
          : 'border-[#e5e7eb] bg-white hover:border-[#d1d5db] hover:bg-[#f9fafb]'
      } ${dragOver ? 'ring-2 ring-[#3b82f6] ring-offset-1' : ''}`}
    >
      {/* Drag handle — active when this card is reorderable. The grip
          cursor on hover surfaces the affordance. Site-chrome rows
          render the glyph dimmed (no draggable, no cursor change). */}
      <GripVertical
        className={`w-3.5 h-3.5 flex-shrink-0 ${
          draggable
            ? 'text-gray-400 group-hover:text-gray-600 cursor-grab active:cursor-grabbing'
            : 'text-gray-200'
        }`}
      />

      {/* Icon tile — matches Cafe24's square icon container at ~32px */}
      <div className={`w-8 h-8 rounded flex items-center justify-center flex-shrink-0 ${
        selected ? 'bg-[#3b82f6] text-white' : 'bg-[#f3f4f6] text-[#6b7280]'
      } transition-colors`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#1f2937] truncate leading-tight">
          {section.name}
        </div>
        <div className={`text-[11px] mt-0.5 truncate ${
          section.visible ? 'text-[#6b7280]' : 'text-[#9ca3af]'
        }`}>
          {section.status}
          {section.hint && (
            <span className="text-[#9ca3af] ml-1.5">· {section.hint}</span>
          )}
        </div>
      </div>

      {/* Visibility indicator — read-only Phase 1 MVP. */}
      <div
        className={`flex-shrink-0 p-1 ${section.visible ? 'text-[#6b7280]' : 'text-[#d1d5db]'}`}
        title={section.visible ? '표시 중' : '숨김'}
      >
        {section.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
      </div>

      {/* Edit chevron — opens the inline EditorDrawer instead of
          navigating out. The operator stays in the builder context the
          whole time. Shift/Ctrl/Cmd-click could fall back to the
          regular full-page route, but for the MVP we keep behavior
          consistent (always opens the drawer). */}
      <button
        type="button"
        onClick={e => { e.stopPropagation(); onEdit(); }}
        className="flex-shrink-0 p-1 text-[#9ca3af] hover:text-[#3b82f6] hover:bg-[#eff6ff] rounded transition-colors"
        title="편집"
        aria-label={`${section.name} 편집`}
      >
        {selected ? <Pencil className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>
    </div>
  );
}
