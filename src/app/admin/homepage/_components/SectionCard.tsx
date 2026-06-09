'use client';

import Link from 'next/link';
import { Pencil, Eye, EyeOff, GripVertical } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

/**
 * SectionCard — one row in the homepage builder's section list. Mirrors
 * the Cafe24 admin pattern Songyi pointed at: drag handle on the left,
 * icon + Korean name + status badge, eye toggle, edit pencil. Eye toggle
 * is read-only for now (Phase 1 MVP); drag-reorder + visibility writes
 * will land in a follow-up once the order/visibility columns ship.
 */
export interface SectionDef {
  /** Stable id used for selection state. */
  key: string;
  /** Display name shown on the card. */
  name: string;
  /** Lucide icon component. */
  icon: LucideIcon;
  /** Admin route this card deep-links into. The ?from=homepage suffix
   *  is appended automatically by the hub so the back-to-hub breadcrumb
   *  shows up in the destination's layout header. */
  href: string;
  /** Short status label — "활성 3개" / "비공개" / "데이터 없음". */
  status: string;
  /** When true, the section is currently rendered on the storefront.
   *  Drives the eye icon and the dimmed/active card styling. */
  visible: boolean;
  /** Optional hint shown under the name explaining what the section is. */
  hint?: string;
}

interface Props {
  section: SectionDef;
  selected: boolean;
  onSelect: () => void;
}

export default function SectionCard({ section, selected, onSelect }: Props) {
  const Icon = section.icon;
  return (
    <div
      onClick={onSelect}
      className={`group flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-all ${
        selected
          ? 'border-brand-primary bg-brand-primary/5 shadow-sm'
          : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
      } ${!section.visible ? 'opacity-60' : ''}`}
    >
      {/* Drag handle (decorative for MVP — wired in Phase 1.5). The grip
          glyph signals reorderability to Songyi even before the wiring
          lands; better than an empty space that suggests nothing. */}
      <GripVertical className="w-4 h-4 text-gray-300 group-hover:text-gray-400 flex-shrink-0" />

      <div className={`w-9 h-9 rounded-md flex items-center justify-center flex-shrink-0 ${
        selected ? 'bg-brand-primary text-white' : 'bg-gray-100 text-gray-600'
      }`}>
        <Icon className="w-4 h-4" />
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800 truncate">{section.name}</span>
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={`text-[11px] ${
            section.visible ? 'text-gray-500' : 'text-gray-400'
          }`}>
            {section.status}
          </span>
        </div>
        {section.hint && (
          <p className="text-[10px] text-gray-400 mt-0.5 truncate">{section.hint}</p>
        )}
      </div>

      {/* Visibility indicator — read-only in Phase 1 MVP (write path
          lands once a section_visibility column ships across the
          relevant config tables). */}
      <div className="flex-shrink-0 p-1.5 text-gray-400" title={section.visible ? '표시 중' : '숨김'}>
        {section.visible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
      </div>

      <Link
        href={`${section.href}?from=homepage`}
        onClick={e => e.stopPropagation()}
        className="flex-shrink-0 p-1.5 text-gray-500 hover:text-brand-primary hover:bg-brand-primary/10 rounded transition-colors"
        title="편집"
      >
        <Pencil className="w-4 h-4" />
      </Link>
    </div>
  );
}
